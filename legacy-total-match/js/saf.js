/* ================= TOTAL MATCH — SAF (investidor) v2 =================
   Propostas mais comuns em clubes pequenos / divisões e ligas menores, raras em gigantes.
   Proposta chega nas notificações (tela própria com todos os detalhes), 70 cláusulas em 6 categorias,
   satisfação do investidor, eventos interativos (reuniões, exigências, vendas sugeridas, aportes extras),
   painel da SAF (pedir aporte, renegociar cláusula, recomprar participação, encerrar). */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };
  function money(c, v) { return C().fmtMoney(c, v); }
  function mult(c) { return c.money ? c.money.mult : 1; }
  function club(c) { return TM.data.club(c.teamId); }
  function roster(c) { try { return C().rosterPlayers(c); } catch (e) { return []; } }
  function mv(p) { try { return TM.data.marketValue(p) || 0; } catch (e) { return 0; } }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rnd(a.length)]; }
  function isPro() { try { return TM.storage.edition && TM.storage.edition() === "pro"; } catch (e) { return false; } }
  function save(c) { TM.storage.saveCoachCareer(c); }
  function note(c, n) { return TM.notify.push(c, n); }
  function season(c) { return c.season || 1; }
  function day(c) { return c.currentDay || 0; }
  function nat(p) { return p.nationId || p.nat || null; }
  function clubNation(c) { try { return club(c).nationId || null; } catch (e) { return null; } }
  function post(c, icon, title, text) { try { if (TM.social && TM.social.marketPost) TM.social.marketPost(c, { icon: icon, title: title, text: text }); } catch (e) {} }

  /* ---------- tamanho do clube: 0 (mínimo) a 100 (gigante) ---------- */
  var LEAGUE_TIER = { en: 3, es: 3, it: 3, de: 3, fr: 3, br: 2, ar: 2, pt: 2, nl: 2, tr: 2, mx: 2, us: 2, sa: 2, rus: 2, ru: 1, be: 1, ch: 1, jp: 1, uy: 1, co: 1, ec: 1, py: 1, ma: 1 };
  function leagueTier(lg) { if (!lg) return 1; if (/\d$/.test(lg)) return 0; return LEAGUE_TIER[lg] == null ? 1 : LEAGUE_TIER[lg]; }
  function clubSize(c) {
    var cl = club(c); if (!cl) return 50;
    var r = TM.data.clubRating(c.teamId), t = leagueTier(cl.leagueId), pop = c.popularity || 40;
    var s = (r - 58) * 2.4 + t * 9 + (pop - 40) * 0.25;
    return Math.max(0, Math.min(100, Math.round(s)));
  }
  function sizeLabel(s) { return s < 20 ? "clube pequeno" : s < 40 ? "clube médio-pequeno" : s < 60 ? "clube médio" : s < 80 ? "clube grande" : "gigante"; }
  // chance de receber proposta em cada janela
  function offerChance(c) {
    var s = clubSize(c);
    var base = s < 20 ? 0.55 : s < 35 ? 0.42 : s < 50 ? 0.25 : s < 65 ? 0.12 : s < 80 ? 0.04 : 0.012;
    if (c.budget < 0) base += 0.08;
    if (c.safEnded && season(c) - (c.safEnded.season || 0) < 2) base *= 0.4;
    return Math.min(0.75, base);
  }

  /* ---------- investidores ---------- */
  var INV_REAL = ["Grupo 777 Partners", "Eagle Football", "City Football Group", "Red Bull", "Fundo Mubadala", "Grupo Textor", "Fundo PIF", "Clearlake Capital", "RedBird Capital", "Grupo Fenway", "Grupo Squadra", "Ares Management", "Fundo QSI", "Grupo Pacific Media", "Grupo Amazônia Capital", "Grupo Ronaldo Nazário", "Fundo Kapital", "Grupo Pari Passu"];
  var INV_GEN = ["Grupo Atlas Capital", "Fundo Meridiano", "Horizonte Sports Group", "Fundo Vértice", "Grupo Alfa Esportes", "Continental Sports Fund", "Grupo Pátria Sports", "Nova Era Capital", "Fundo Aurora", "Grupo Ípsilon", "Bravo Sports Partners", "Fundo Oceânico"];
  var TYPES = [
    { id: "fundo", label: "Fundo de investimento", focus: ["receita", "propostas", "mercado"], patience: 2, desc: "Quer retorno financeiro: receita, vendas com lucro e caixa saudável." },
    { id: "empresario", label: "Empresário torcedor", focus: ["esportivo", "elenco", "gestao"], patience: 3, desc: "Quer títulos e identidade: resultados, ídolos e base." },
    { id: "grupo", label: "Grupo multi-clube", focus: ["elenco", "mercado", "gestao"], patience: 3, desc: "Quer ativos: jovens valorizáveis, estrutura e gestão de elenco." },
    { id: "midia", label: "Grupo de mídia", focus: ["receita", "gestao", "esportivo"], patience: 2, desc: "Quer audiência: popularidade, patrocínios e jogos decisivos." },
    { id: "estatal", label: "Fundo soberano", focus: ["esportivo", "mercado", "elenco"], patience: 3, desc: "Quer projeção: contratações de impacto e títulos." }
  ];
  function pickType(c) { return pick(TYPES); }
  function investorName(c) { return pick(isPro() ? INV_REAL : INV_GEN); }

  /* ---------- catálogo de cláusulas (70) ----------
     cada uma: id, cat, when ("season" = fim da temporada | "event" = na hora), fine (% do aporte),
     make(c) -> parâmetros (ou null se não se aplica), text(c,cl), check(c,cl,ctx) -> {ok, why} */
  function ageOf(p) { return p.age || 26; }
  function seasonDeals(c, type, kind) { return (c.deals || []).filter(function (d) { return d.season === season(c) && (!type || d.type === type) && (!kind || d.kind === kind); }); }
  function inDeals(c) { return seasonDeals(c, "in"); }
  function outDeals(c) { return seasonDeals(c, "out"); }
  function statsDelta(c) {
    var s = c.stats || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }, a = (c.saf && c.saf.statsAt) || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    var o = {}; ["p", "w", "d", "l", "gf", "ga"].forEach(function (k) { o[k] = Math.max(0, (s[k] || 0) - (a[k] || 0)); }); return o;
  }
  function pos(c) { try { return C().currentPosition(c); } catch (e) { return 10; } }
  function wageBill(c) { return roster(c).reduce(function (s, p) { return s + mv(p) * 0.075; }, 0) * mult(c); }
  function squadValue(c) { return roster(c).reduce(function (s, p) { return s + mv(p); }, 0) * mult(c); }
  function startersOv(c) { var xi = roster(c).slice().sort(function (a, b) { return b.overall - a.overall; }).slice(0, 11); return xi.length ? Math.round(xi.reduce(function (s, p) { return s + p.overall; }, 0) / xi.length) : 0; }
  function homegrownCount(c) { return roster(c).filter(function (p) { return c.homegrown && c.homegrown[p.id]; }).length; }
  function nationals(c) { var n = clubNation(c); return roster(c).filter(function (p) { return n && nat(p) === n; }).length; }
  function foreigners(c) { var n = clubNation(c); return roster(c).filter(function (p) { return n && nat(p) && nat(p) !== n; }).length; }
  function sponsorsCount(c) { var n = 0; if (c.sponsors) Object.keys(c.sponsors).forEach(function (k) { if (c.sponsors[k]) n++; }); return n; }
  function loansActive(c) { return (c.loans || []).filter(function (l) { return l.left > 0; }).length; }
  function loanInsCount(c) { return c.loanedIn ? Object.keys(c.loanedIn).length : 0; }
  function bestPlayer(c) { return roster(c).slice().sort(function (a, b) { return b.overall - a.overall; })[0]; }
  function metaPos(c) { return Math.max(1, ((c.objective && c.objective.maxPos) || 8) - 1); }
  function R(n) { return Math.round(n); }
  function M(c, n) { return money(c, R(n)); }
  function goalOf(c) { var st = statsDelta(c); return st; }
  var POS_PT = { GK: "goleiro", DF: "defensor", MF: "meio-campista", FW: "atacante" };

  var CAT = {};
  function def(id, cat, when, fine, make, text, check) { CAT[id] = { id: id, cat: cat, when: when, fine: fine, make: make, text: text, check: check }; }
  var yes = function () { return {}; };
  // ===== RECEITA (13) =====
  def("caixa_positivo", "receita", "season", 0.10, yes, function () { return "Terminar a temporada com o caixa positivo"; }, function (c) { return { ok: c.budget >= 0, why: "O caixa fechou em " + money(c, R(c.budget)) + "." }; });
  def("caixa_minimo", "receita", "season", 0.10, function (c) { return { m: R(Math.max(5 * mult(c), c.budget * 0.5)) }; }, function (c, cl) { return "Fechar a temporada com ao menos " + M(c, cl.m) + " em caixa"; }, function (c, cl) { return { ok: c.budget >= cl.m, why: "O caixa fechou em " + money(c, R(c.budget)) + "; o mínimo era " + M(c, cl.m) + "." }; });
  def("patrocinio_master", "receita", "season", 0.08, yes, function () { return "Ter um patrocinador master ativo ao fim da temporada"; }, function (c) { return { ok: !!(c.sponsors && c.sponsors.master), why: "O clube terminou a temporada sem patrocinador master." }; });
  def("dois_patrocinios", "receita", "season", 0.08, yes, function () { return "Ter ao menos 2 patrocinadores ativos ao fim da temporada"; }, function (c) { var n = sponsorsCount(c); return { ok: n >= 2, why: "Só " + n + " patrocinador(es) ativo(s)." }; });
  def("fornecedor", "receita", "season", 0.06, yes, function () { return "Ter contrato com fornecedora de material esportivo"; }, function (c) { return { ok: !!c.supplier, why: "Nenhuma fornecedora de material contratada." }; });
  def("vendas_minimas", "receita", "season", 0.12, function (c) { return { m: R((6 + clubSize(c) * 0.5) * mult(c)) }; }, function (c, cl) { return "Arrecadar ao menos " + M(c, cl.m) + " com vendas de jogadores na temporada"; }, function (c, cl) { var s = outDeals(c).reduce(function (a, d) { return a + (d.fee || 0); }, 0); return { ok: s >= cl.m, why: "As vendas somaram " + M(c, s) + "; o mínimo era " + M(c, cl.m) + "." }; });
  def("balanco_positivo", "receita", "season", 0.10, yes, function () { return "Fechar a temporada com saldo de transferências positivo (vender mais do que comprar)"; }, function (c) { var s = outDeals(c).reduce(function (a, d) { return a + (d.fee || 0); }, 0), g = inDeals(c).reduce(function (a, d) { return a + (d.fee || 0); }, 0); return { ok: s >= g, why: "Comprou " + M(c, g) + " e vendeu " + M(c, s) + "." }; });
  def("sem_divida", "receita", "season", 0.10, yes, function () { return "Não ter empréstimos bancários em aberto ao fim da temporada"; }, function (c) { var n = loansActive(c); return { ok: n === 0, why: n + " empréstimo(s) bancário(s) ainda em aberto." }; });
  def("sem_emprestimo", "receita", "event", 0.10, yes, function () { return "Não pegar empréstimos bancários enquanto a SAF vigorar"; }, null);
  def("estadio_1", "receita", "season", 0.10, function (c) { return (c.stadiumUp || 0) < 3 ? { lvl: (c.stadiumUp || 0) + 1 } : null; }, function (c, cl) { return "Ampliar o estádio para o nível " + cl.lvl + " até o fim da temporada"; }, function (c, cl) { return { ok: (c.stadiumUp || 0) >= cl.lvl, why: "O estádio ficou no nível " + (c.stadiumUp || 0) + "." }; });
  def("ct_1", "receita", "season", 0.08, function (c) { return (c.ctLevel || 2) < 5 ? { lvl: (c.ctLevel || 2) + 1 } : null; }, function (c, cl) { return "Melhorar o centro de treinamento para o nível " + cl.lvl; }, function (c, cl) { return { ok: (c.ctLevel || 2) >= cl.lvl, why: "O CT ficou no nível " + (c.ctLevel || 2) + "." }; });
  def("folha", "receita", "season", 0.10, function (c) { return { m: R(wageBill(c) * 1.15) }; }, function (c, cl) { return "Manter a folha salarial abaixo de " + M(c, cl.m) + " por temporada"; }, function (c, cl) { var w = wageBill(c); return { ok: w <= cl.m, why: "A folha ficou em " + M(c, w) + ", acima de " + M(c, cl.m) + "." }; });
  def("valor_elenco", "receita", "season", 0.10, function (c) { return { m: R(squadValue(c) * 1.08) }; }, function (c, cl) { return "Valorizar o elenco: valor de mercado total de ao menos " + M(c, cl.m) + " ao fim da temporada"; }, function (c, cl) { var v = squadValue(c); return { ok: v >= cl.m, why: "O elenco vale " + M(c, v) + "; a meta era " + M(c, cl.m) + "." }; });
  // ===== ELENCO (14) =====
  def("sub21", "elenco", "season", 0.08, function () { return { n: 3 }; }, function (c, cl) { return "Ter ao menos " + cl.n + " jogadores de até 21 anos no elenco ao fim da temporada"; }, function (c, cl) { var n = roster(c).filter(function (p) { return ageOf(p) <= 21; }).length; return { ok: n >= cl.n, why: "Só " + n + " jogador(es) de até 21 anos." }; });
  def("sub23", "elenco", "season", 0.08, function () { return { n: 6 }; }, function (c, cl) { return "Ter ao menos " + cl.n + " jogadores de até 23 anos no elenco"; }, function (c, cl) { var n = roster(c).filter(function (p) { return ageOf(p) <= 23; }).length; return { ok: n >= cl.n, why: "Só " + n + " jogador(es) de até 23 anos." }; });
  def("media_idade", "elenco", "season", 0.08, function () { return { a: 27 }; }, function (c, cl) { return "Manter a média de idade do elenco em até " + cl.a + " anos"; }, function (c, cl) { var r = roster(c); var a = r.length ? r.reduce(function (s, p) { return s + ageOf(p); }, 0) / r.length : 0; return { ok: a <= cl.a, why: "A média de idade ficou em " + a.toFixed(1) + " anos." }; });
  def("elenco_max", "elenco", "season", 0.08, function () { return { n: 30 }; }, function (c, cl) { return "Elenco com no máximo " + cl.n + " jogadores (enxugar custos)"; }, function (c, cl) { var n = roster(c).length; return { ok: n <= cl.n, why: "O elenco tem " + n + " jogadores." }; });
  def("elenco_min", "elenco", "season", 0.08, function () { return { n: 22 }; }, function (c, cl) { return "Elenco com ao menos " + cl.n + " jogadores (profundidade)"; }, function (c, cl) { var n = roster(c).length; return { ok: n >= cl.n, why: "O elenco tem só " + n + " jogadores." }; });
  def("crias", "elenco", "season", 0.10, function (c) { return { n: Math.max(2, homegrownCount(c)) }; }, function (c, cl) { return "Manter ao menos " + cl.n + " crias da base no elenco"; }, function (c, cl) { var n = homegrownCount(c); return { ok: n >= cl.n, why: "Só " + n + " cria(s) da base no elenco." }; });
  def("nacionais", "elenco", "season", 0.08, function (c) { return clubNation(c) ? { n: Math.max(8, nationals(c) - 2) } : null; }, function (c, cl) { return "Ter ao menos " + cl.n + " jogadores do país no elenco"; }, function (c, cl) { var n = nationals(c); return { ok: n >= cl.n, why: "Só " + n + " jogador(es) do país." }; });
  def("estrangeiros_max", "elenco", "season", 0.08, function (c) { return clubNation(c) ? { n: Math.max(5, foreigners(c) + 1) } : null; }, function (c, cl) { return "No máximo " + cl.n + " estrangeiros no elenco"; }, function (c, cl) { var n = foreigners(c); return { ok: n <= cl.n, why: n + " estrangeiros no elenco; o máximo era " + cl.n + "." }; });
  def("capitao", "elenco", "event", 0.15, function (c) { var p = c.captainId ? roster(c).filter(function (x) { return x.id === c.captainId; })[0] : null; return p ? { pid: p.id, pname: p.name } : null; }, function (c, cl) { return "Não vender o capitão " + cl.pname; }, null);
  def("simbolo", "elenco", "event", 0.25, function (c) { var p = bestPlayer(c); return p ? { pid: p.id, pname: p.name } : null; }, function (c, cl) { return "Não vender " + cl.pname + ", o jogador-símbolo do projeto"; }, null);
  def("titulares_ov", "elenco", "season", 0.10, function (c) { return { ov: startersOv(c) }; }, function (c, cl) { return "Manter a força dos titulares em ao menos " + cl.ov + " de overall médio"; }, function (c, cl) { var o = startersOv(c); return { ok: o >= cl.ov, why: "Os titulares ficaram em " + o + " de média; a meta era " + cl.ov + "." }; });
  def("goleiro_reserva", "elenco", "season", 0.06, function (c) { return { ov: Math.max(60, startersOv(c) - 8) }; }, function (c, cl) { return "Ter um goleiro reserva de ao menos " + cl.ov + " de overall"; }, function (c, cl) { var gks = roster(c).filter(function (p) { return p.pos === "GK"; }).sort(function (a, b) { return b.overall - a.overall; }); var ok = gks.length >= 2 && gks[1].overall >= cl.ov; return { ok: ok, why: gks.length < 2 ? "Só um goleiro no elenco." : "O goleiro reserva tem " + gks[1].overall + " de overall." }; });
  def("sem_veteranos", "elenco", "season", 0.08, function () { return { a: 34 }; }, function (c, cl) { return "Nenhum jogador com " + cl.a + " anos ou mais no elenco ao fim da temporada"; }, function (c, cl) { var n = roster(c).filter(function (p) { return ageOf(p) >= cl.a; }).length; return { ok: n === 0, why: n + " jogador(es) com " + cl.a + "+ anos no elenco." }; });
  def("promessa", "elenco", "season", 0.08, function () { return { n: 2, t: 78 }; }, function (c, cl) { return "Ter ao menos " + cl.n + " jogadores de até 22 anos com potencial " + cl.t + "+"; }, function (c, cl) { var n = roster(c).filter(function (p) { return ageOf(p) <= 22 && (p.potential || 0) >= cl.t; }).length; return { ok: n >= cl.n, why: "Só " + n + " promessa(s) com potencial " + cl.t + "+." }; });
  def("selecionaveis", "elenco", "season", 0.06, function () { return { n: 2, ov: 76 }; }, function (c, cl) { return "Ter ao menos " + cl.n + " jogadores de nível de seleção (overall " + cl.ov + "+)"; }, function (c, cl) { var n = roster(c).filter(function (p) { return p.overall >= cl.ov; }).length; return { ok: n >= cl.n, why: "Só " + n + " jogador(es) com overall " + cl.ov + "+." }; });
  // ===== PROPOSTAS (9) =====
  def("aceitar_europa", "propostas", "event", 0.10, yes, function () { return "Aceitar qualquer proposta de clube europeu acima do valor de mercado por um jogador seu"; }, null);
  def("aceitar_dobro", "propostas", "event", 0.12, yes, function () { return "Aceitar qualquer proposta de ao menos o dobro do valor de mercado por um jogador seu"; }, null);
  def("aceitar_30", "propostas", "event", 0.08, yes, function () { return "Aceitar propostas acima do valor de mercado por jogadores com 30 anos ou mais"; }, null);
  def("aceitar_reserva", "propostas", "event", 0.08, yes, function () { return "Aceitar propostas acima do valor de mercado por reservas (fora dos 14 melhores)"; }, null);
  def("venda_grande", "propostas", "season", 0.12, function (c) { var b = bestPlayer(c); return { m: R(Math.max(2 * mult(c), (b ? mv(b) : 5) * 0.6 * mult(c))) }; }, function (c, cl) { return "Vender ao menos um jogador por " + M(c, cl.m) + " ou mais na temporada"; }, function (c, cl) { var mx = outDeals(c).reduce(function (a, d) { return Math.max(a, d.fee || 0); }, 0); return { ok: mx >= cl.m, why: "A maior venda foi de " + M(c, mx) + "." }; });
  def("duas_vendas", "propostas", "season", 0.08, function () { return { n: 2 }; }, function (c, cl) { return "Vender ao menos " + cl.n + " jogadores na temporada"; }, function (c, cl) { var n = outDeals(c).length; return { ok: n >= cl.n, why: "Só " + n + " venda(s) na temporada." }; });
  def("nao_vender_abaixo", "propostas", "event", 0.10, yes, function () { return "Não vender nenhum jogador abaixo do valor de mercado"; }, null);
  def("nao_vender_sub21", "propostas", "event", 0.12, yes, function () { return "Não vender jogadores de até 21 anos (o investidor quer valorizá-los)"; }, null);
  def("max_titulares_vendidos", "propostas", "season", 0.12, function () { return { n: 2 }; }, function (c, cl) { return "Não vender mais de " + cl.n + " titulares na temporada"; }, function (c, cl) { var n = outDeals(c).filter(function (d) { return (d.ov || 0) >= startersOv(c) - 3; }).length; return { ok: n <= cl.n, why: n + " titulares vendidos." }; });
  // ===== MERCADO (14) =====
  def("investir_aporte", "mercado", "season", 0.10, function () { return { pct: 0.5 }; }, function (c, cl) { return "Investir ao menos metade do aporte em contratações nesta temporada"; }, function (c, cl) { var g = inDeals(c).reduce(function (a, d) { return a + (d.fee || 0); }, 0), need = (c.saf ? c.saf.amountM : 0) * cl.pct; return { ok: g >= need, why: "Foram investidos " + M(c, g) + "; o mínimo era " + M(c, need) + "." }; });
  def("gasto_max", "mercado", "season", 0.12, function (c) { return { m: R(Math.max(3 * mult(c), (c.saf ? c.saf.amountM : 20 * mult(c)) * 0.8)) }; }, function (c, cl) { return "Gastar no máximo " + M(c, cl.m) + " em contratações na temporada"; }, function (c, cl) { var g = inDeals(c).reduce(function (a, d) { return a + (d.fee || 0); }, 0); return { ok: g <= cl.m, why: "Foram gastos " + M(c, g) + "; o teto era " + M(c, cl.m) + "." }; });
  def("teto_contratacao", "mercado", "event", 0.10, function (c) { return { m: R(Math.max(2 * mult(c), (c.saf ? c.saf.amountM : 20 * mult(c)) * 0.4)) }; }, function (c, cl) { return "Nenhuma contratação acima de " + M(c, cl.m); }, null);
  def("sem_30", "mercado", "event", 0.08, yes, function () { return "Não contratar jogadores com 30 anos ou mais"; }, null);
  def("contratar_sub23", "mercado", "season", 0.08, function () { return { n: 2 }; }, function (c, cl) { return "Contratar ao menos " + cl.n + " jogadores de até 23 anos na temporada"; }, function (c, cl) { var n = inDeals(c).filter(function (d) { var p = TM.data.player(d.pid); return p && ageOf(p) <= 23; }).length; return { ok: n >= cl.n, why: "Só " + n + " contratação(ões) de até 23 anos." }; });
  def("contratar_nacional", "mercado", "season", 0.06, function (c) { return clubNation(c) ? { n: 1 } : null; }, function (c, cl) { return "Contratar ao menos " + cl.n + " jogador do país na temporada"; }, function (c, cl) { var cn = clubNation(c); var n = inDeals(c).filter(function (d) { var p = TM.data.player(d.pid); return p && nat(p) === cn; }).length; return { ok: n >= cl.n, why: "Nenhuma contratação de jogador do país." }; });
  def("contratar_estrangeiro", "mercado", "season", 0.06, function (c) { return clubNation(c) ? { n: 1 } : null; }, function (c, cl) { return "Contratar ao menos " + cl.n + " jogador de outro país (projeção internacional)"; }, function (c, cl) { var cn = clubNation(c); var n = inDeals(c).filter(function (d) { var p = TM.data.player(d.pid); return p && nat(p) && nat(p) !== cn; }).length; return { ok: n >= cl.n, why: "Nenhuma contratação internacional." }; });
  def("max_contratacoes", "mercado", "season", 0.08, function () { return { n: 5 }; }, function (c, cl) { return "No máximo " + cl.n + " contratações na temporada (planejamento)"; }, function (c, cl) { var n = inDeals(c).length; return { ok: n <= cl.n, why: n + " contratações na temporada." }; });
  def("min_contratacoes", "mercado", "season", 0.08, function () { return { n: 3 }; }, function (c, cl) { return "Ao menos " + cl.n + " contratações na temporada (renovar o elenco)"; }, function (c, cl) { var n = inDeals(c).length; return { ok: n >= cl.n, why: "Só " + n + " contratação(ões)." }; });
  def("max_emprestimos_in", "mercado", "season", 0.06, function () { return { n: 2 }; }, function (c, cl) { return "No máximo " + cl.n + " jogadores emprestados de outros clubes no elenco"; }, function (c, cl) { var n = loanInsCount(c); return { ok: n <= cl.n, why: n + " jogadores emprestados no elenco." }; });
  def("reforco_posicao", "mercado", "season", 0.10, function (c) { var r = roster(c), cnt = {}; r.forEach(function (p) { cnt[p.pos] = (cnt[p.pos] || 0) + 1; }); var need = ["GK", "DF", "MF", "FW"].sort(function (a, b) { return ((cnt[a] || 0) / (a === "GK" ? 3 : a === "DF" ? 8 : a === "MF" ? 8 : 6)) - ((cnt[b] || 0) / (b === "GK" ? 3 : b === "DF" ? 8 : b === "MF" ? 8 : 6)); })[0]; return { pos: need, ov: Math.max(60, startersOv(c) - 4) }; }, function (c, cl) { return "Contratar um " + POS_PT[cl.pos] + " de overall " + cl.ov + "+ na temporada"; }, function (c, cl) { var ok = inDeals(c).some(function (d) { return d.pos === cl.pos && (d.ov || 0) >= cl.ov; }); return { ok: ok, why: "Nenhum " + POS_PT[cl.pos] + " de " + cl.ov + "+ contratado." }; });
  def("reforco_impacto", "mercado", "season", 0.12, function (c) { return { ov: startersOv(c) + 2 }; }, function (c, cl) { return "Contratar ao menos um jogador de impacto (overall " + cl.ov + "+) na temporada"; }, function (c, cl) { var ok = inDeals(c).some(function (d) { return (d.ov || 0) >= cl.ov; }); return { ok: ok, why: "Nenhuma contratação de overall " + cl.ov + "+." }; });
  def("sem_parcelamento", "mercado", "season", 0.06, yes, function () { return "Não deixar parcelas de contratações em aberto ao fim da temporada"; }, function (c) { var n = (c.installments || []).filter(function (i) { return (i.left || 0) > 0; }).length; return { ok: n === 0, why: n + " parcelamento(s) em aberto." }; });
  def("sem_agente_livre", "mercado", "season", 0.05, yes, function () { return "Não contratar agentes livres na temporada (o investidor quer ativos com valor)"; }, function (c) { var n = inDeals(c).filter(function (d) { return /livre|free/i.test(d.other || "") || d.kind === "free"; }).length; return { ok: n === 0, why: n + " agente(s) livre(s) contratado(s)." }; });
  // ===== ESPORTIVO (12) =====
  def("meta", "esportivo", "season", 0.15, function (c) { return { pos: metaPos(c) }; }, function (c, cl) { return "Terminar a liga em " + cl.pos + "º lugar ou melhor"; }, function (c, cl) { var p = pos(c); return { ok: p <= cl.pos, why: "O time terminou em " + p + "º; a meta era " + cl.pos + "º." }; });
  def("titulo", "esportivo", "season", 0.12, function (c) { return TM.data.clubRating(c.teamId) >= 76 ? {} : null; }, function () { return "Conquistar ao menos um título na temporada"; }, function (c) { return { ok: (c.honours || []).length > ((c.saf && c.saf.honoursAt) || 0), why: "Nenhum título conquistado na temporada." }; });
  def("vitorias", "esportivo", "season", 0.10, function (c) { return { n: 14 }; }, function (c, cl) { return "Vencer ao menos " + cl.n + " jogos na temporada"; }, function (c, cl) { var s = statsDelta(c); return { ok: s.w >= cl.n, why: "Foram " + s.w + " vitórias; a meta era " + cl.n + "." }; });
  def("derrotas_max", "esportivo", "season", 0.10, function () { return { n: 12 }; }, function (c, cl) { return "Perder no máximo " + cl.n + " jogos na temporada"; }, function (c, cl) { var s = statsDelta(c); return { ok: s.l <= cl.n, why: "Foram " + s.l + " derrotas; o máximo era " + cl.n + "." }; });
  def("gols", "esportivo", "season", 0.08, function () { return { n: 50 }; }, function (c, cl) { return "Marcar ao menos " + cl.n + " gols na temporada (futebol atrativo)"; }, function (c, cl) { var s = statsDelta(c); return { ok: s.gf >= cl.n, why: "O time marcou " + s.gf + " gols." }; });
  def("gols_sofridos", "esportivo", "season", 0.08, function () { return { n: 40 }; }, function (c, cl) { return "Sofrer no máximo " + cl.n + " gols na temporada"; }, function (c, cl) { var s = statsDelta(c); return { ok: s.ga <= cl.n, why: "O time sofreu " + s.ga + " gols." }; });
  def("aproveitamento", "esportivo", "season", 0.10, function () { return { pct: 50 }; }, function (c, cl) { return "Aproveitamento de ao menos " + cl.pct + "% na temporada"; }, function (c, cl) { var s = statsDelta(c); var pct = s.p ? R(100 * (s.w * 3 + s.d) / (s.p * 3)) : 0; return { ok: pct >= cl.pct, why: "O aproveitamento foi de " + pct + "%." }; });
  def("sem_4_derrotas", "esportivo", "event", 0.08, yes, function () { return "Nunca perder 4 jogos seguidos"; }, null);
  def("classicos", "esportivo", "season", 0.08, yes, function () { return "Não perder clássicos na temporada"; }, function (c) { var n = (c.classicoLoss || 0) - ((c.saf && c.saf.classicoAt) || 0); return { ok: n <= 0, why: n + " clássico(s) perdido(s)." }; });
  def("saldo_gols", "esportivo", "season", 0.08, function () { return { n: 5 }; }, function (c, cl) { return "Saldo de gols de ao menos +" + cl.n + " na temporada"; }, function (c, cl) { var s = statsDelta(c); return { ok: (s.gf - s.ga) >= cl.n, why: "O saldo ficou em " + (s.gf - s.ga) + "." }; });
  def("copa", "esportivo", "season", 0.10, yes, function () { return "Ser campeão da copa nacional ou terminar a liga entre os 4 primeiros"; }, function (c) { var champ = !!(c.cup && c.cup.championId === c.teamId); var p = pos(c); return { ok: champ || p <= 4, why: "Sem título da copa e liga terminada em " + p + "º." }; });
  def("invicto_10", "esportivo", "season", 0.08, function () { return { n: 6 }; }, function (c, cl) { return "Ter uma sequência de ao menos " + cl.n + " jogos sem perder na temporada"; }, function (c, cl) { var best = (c.saf && c.saf.bestUnbeaten) || 0; return { ok: best >= cl.n, why: "A maior sequência invicta foi de " + best + " jogos." }; });
  // ===== GESTÃO (8) =====
  def("popularidade", "gestao", "season", 0.08, function (c) { return { n: Math.min(95, (c.popularity || 40) + 5) }; }, function (c, cl) { return "Elevar a popularidade do clube para " + cl.n + "+"; }, function (c, cl) { return { ok: (c.popularity || 0) >= cl.n, why: "A popularidade ficou em " + (c.popularity || 0) + "." }; });
  def("reputacao", "gestao", "season", 0.08, function (c) { return { n: Math.min(95, (c.reputation || 18) + 5) }; }, function (c, cl) { return "Elevar sua reputação como treinador para " + cl.n + "+"; }, function (c, cl) { return { ok: (c.reputation || 0) >= cl.n, why: "A reputação ficou em " + (c.reputation || 0) + "." }; });
  def("confianca", "gestao", "season", 0.08, function () { return { n: 55 }; }, function (c, cl) { return "Manter a confiança da diretoria em " + cl.n + "+ ao fim da temporada"; }, function (c, cl) { var v = c.confidence == null ? 50 : c.confidence; return { ok: v >= cl.n, why: "A confiança ficou em " + v + "." }; });
  def("olheiros", "gestao", "season", 0.05, function () { return { n: 2 }; }, function (c, cl) { return "Manter ao menos " + cl.n + " olheiros contratados"; }, function (c, cl) { var n = (c.scouts || []).length; return { ok: n >= cl.n, why: "Só " + n + " olheiro(s) contratado(s)." }; });
  def("moral", "gestao", "season", 0.06, yes, function () { return "Terminar a temporada com o elenco motivado (moral positiva)"; }, function (c) { return { ok: (c.moraleAdj || 0) >= 0, why: "O elenco terminou desmotivado." }; });
  def("permanencia", "gestao", "event", 0.15, yes, function () { return "O treinador não pode deixar o clube por vontade própria durante a SAF"; }, null);
  def("estadio_2", "gestao", "season", 0.10, function (c) { return (c.stadiumUp || 0) < 2 ? { lvl: 2 } : null; }, function (c, cl) { return "Ter o estádio ampliado ao menos ao nível " + cl.lvl; }, function (c, cl) { return { ok: (c.stadiumUp || 0) >= cl.lvl, why: "O estádio está no nível " + (c.stadiumUp || 0) + "." }; });
  def("reunioes", "gestao", "season", 0.06, yes, function () { return "Responder a todas as reuniões e pedidos do investidor"; }, function (c) { var n = (c.saf && c.saf.ignored) || 0; return { ok: n === 0, why: n + " pedido(s) do investidor ficaram sem resposta." }; });
  var CAT_ORDER = ["receita", "elenco", "propostas", "mercado", "esportivo", "gestao"];
  var CAT_LABEL = { receita: "💰 Receita", elenco: "👥 Elenco", propostas: "📨 Propostas", mercado: "🔁 Mercado", esportivo: "🏆 Esportivo", gestao: "🏢 Gestão" };
  var CAT_ICON = { receita: "💰", elenco: "👥", propostas: "📨", mercado: "🔁", esportivo: "🏆", gestao: "🏢" };
  function makeClause(c, id) {
    var t = CAT[id]; if (!t) return null;
    var params = t.make(c); if (params === null) return null;
    var cl = { id: id, cat: t.cat, when: t.when, finePct: t.fine }; Object.keys(params).forEach(function (k) { cl[k] = params[k]; });
    cl.text = t.text(c, cl); return cl;
  }
  function clauseText(c, cl) { var t = CAT[cl.id]; return t ? t.text(c, cl) : (cl.text || cl.id); }
  function pickClauses(c, type, n, exclude) {
    var ids = Object.keys(CAT).filter(function (id) { return !(exclude || []).some(function (x) { return x.id === id; }); });
    var out = [], tries = 0;
    // sempre uma meta esportiva de liga
    var meta = makeClause(c, "meta"); if (meta && !(exclude || []).some(function (x) { return x.id === "meta"; })) out.push(meta);
    while (out.length < n && tries < 200) {
      tries++;
      var id = pick(ids); if (out.some(function (x) { return x.id === id; })) continue;
      var w = type.focus.indexOf(CAT[id].cat) >= 0 ? 3 : 1;
      if (Math.random() > w / 3) continue;
      var cl = makeClause(c, id); if (cl) out.push(cl);
    }
    return out;
  }

  /* ---------- proposta ---------- */
  function makeOffer(c, w) {
    var r = TM.data.clubRating(c.teamId), m = mult(c), s = clubSize(c), cl = club(c);
    var tier = leagueTier(cl.leagueId);
    var base = (6 + Math.max(0, r - 55) * 3.2) * (tier === 0 ? 0.55 : tier === 1 ? 0.75 : 1) * m;
    var fromCash = Math.max(0, c.budget) * 0.2;
    var amount = R(base + fromCash + (c.budget < 0 ? Math.abs(c.budget) * 0.6 : 0));
    var pct = s < 30 ? 45 + rnd(31) : s < 60 ? 30 + rnd(31) : 15 + rnd(26);   // pequeno: 45–75%, médio: 30–60%, grande: 15–40%
    var type = pickType(c);
    var n = s < 30 ? 3 : s < 60 ? 4 : 5;
    return { amountM: amount, pct: pct, closeDay: w ? w.closeDay : day(c) + 30, windowName: w ? w.name : "janela", investor: investorName(c), type: type.id,
      clauses: pickClauses(c, type, n), term: 3 + rnd(3), bonusPct: 0.15, counter: 0, size: s, day: day(c), season: season(c) };
  }
  function typeOf(id) { return TYPES.filter(function (t) { return t.id === id; })[0] || TYPES[0]; }

  function maybeOffer(c) {
    if (!c.windows) return;
    var d = day(c);
    if (c.safOffer && d >= c.safOffer.closeDay) {
      note(c, { icon: "⌛", title: "Proposta de SAF expirou", text: c.safOffer.investor + " retirou a proposta: a janela fechou sem resposta." });
      c.safOffer = null;
    }
    c.windows.forEach(function (w) {
      var open = d >= w.openDay && d < w.closeDay;
      if (!open || w.safRolled) return;
      w.safRolled = true;
      if (c.safOffer || c.saf) return;
      var s = clubSize(c);
      var minGap = s < 40 ? 0 : s < 70 ? 1 : 2;   // pequenos podem receber toda temporada; gigantes, a cada 3
      if (season(c) - (c.safLastSeason || -9) <= minGap && c.safLastSeason) return;
      if (Math.random() >= offerChance(c)) return;
      c.safOffer = makeOffer(c, w);
      c.safLastSeason = season(c);
      note(c, { icon: "💼", title: "Proposta de SAF", saf: true, news: true,
        text: c.safOffer.investor + " (" + typeOf(c.safOffer.type).label.toLowerCase() + ") quer comprar " + c.safOffer.pct + "% do clube e injetar " + money(c, c.safOffer.amountM) + ". Toque para ver a proposta completa, com as " + c.safOffer.clauses.length + " contrapartidas." });
      post(c, "💼", "Rumor de SAF", "Investidores sondam o " + club(c).name + ": " + c.safOffer.investor + " prepara proposta de compra de parte do clube.");
    });
  }

  function accept(c, route) {
    var o = c.safOffer; if (!o) return;
    c.budget += o.amountM; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.safM = (c.finc.safM || 0) + o.amountM;
    var st = c.stats || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    c.saf = { investor: o.investor, type: o.type, pct: o.pct, season: season(c), amountM: o.amountM, term: o.term, bonusPct: o.bonusPct, clauses: o.clauses || [],
      strikes: 0, patience: typeOf(o.type).patience, sat: 60, log: [], events: 0, ignored: 0,
      statsAt: { p: st.p, w: st.w, d: st.d, l: st.l, gf: st.gf, ga: st.ga }, honoursAt: (c.honours || []).length, classicoAt: c.classicoLoss || 0,
      bestUnbeaten: 0, curUnbeaten: 0, lastEventDay: day(c), nextEventDay: day(c) + 20 + rnd(20), formSeen: 0, extra: 0 };
    markDealsSeen(c);
    note(c, { icon: "💼", title: "SAF fechada", news: true, text: o.investor + " comprou " + o.pct + "% do clube e injetou " + money(c, o.amountM) + ". Acompanhe as contrapartidas e a satisfação do investidor no painel 💼 SAF." });
    post(c, "💼", "SAF", club(c).name + " vira SAF: " + o.investor + " assume " + o.pct + "% do clube com aporte de " + money(c, o.amountM) + ".");
    c.safOffer = null; save(c); TM.ui.toast("Investimento aceito: +" + money(c, o.amountM)); TM.ui.go(route || "coach-hub");
  }
  function reject(c, route) {
    var o = c.safOffer; if (!o) return;
    note(c, { icon: "🚫", title: "SAF recusada", text: "Você recusou a proposta de " + o.investor + "." });
    c.safOffer = null; save(c); TM.ui.go(route || "coach-hub");
  }
  // contraproposta: pedir menos participação ou mais dinheiro (uma vez por proposta)
  function counter(c, kind, route) {
    var o = c.safOffer; if (!o || o.counter) return;
    o.counter = 1;
    var s = o.size == null ? clubSize(c) : o.size;
    var chance = s < 30 ? 0.35 : s < 60 ? 0.5 : 0.65;   // clube maior tem mais poder de barganha
    if (Math.random() < chance) {
      if (kind === "pct") { o.pct = Math.max(10, o.pct - 10); note(c, { icon: "🤝", title: "Contraproposta aceita", saf: true, text: o.investor + " aceitou ficar com " + o.pct + "% do clube pelo mesmo aporte." }); }
      else { o.amountM = R(o.amountM * 1.2); note(c, { icon: "🤝", title: "Contraproposta aceita", saf: true, text: o.investor + " aumentou o aporte para " + money(c, o.amountM) + " pela mesma participação." }); }
      TM.ui.toast("O investidor aceitou a contraproposta!");
    } else {
      var extra = pickClauses(c, typeOf(o.type), 1, o.clauses).filter(function (x) { return x.id !== "meta"; })[0];
      if (extra) o.clauses.push(extra);
      note(c, { icon: "🙅", title: "Contraproposta recusada", saf: true, text: o.investor + " manteve os termos" + (extra ? " e ainda acrescentou uma contrapartida: " + extra.text : "") + ". A proposta continua de pé." });
      TM.ui.toast("O investidor não cedeu.");
    }
    save(c); TM.ui.go(route || "club-saf-offer");
  }

  /* ---------- penalidades e satisfação ---------- */
  function sat(c, d, why) {
    if (!c.saf) return;
    c.saf.sat = Math.max(0, Math.min(100, (c.saf.sat == null ? 60 : c.saf.sat) + d));
    if (why) { c.saf.log = c.saf.log || []; c.saf.log.unshift({ season: season(c), day: day(c), txt: (d >= 0 ? "+" : "") + d + " · " + why }); if (c.saf.log.length > 40) c.saf.log.length = 40; }
  }
  function penalty(c, cl, why) {
    if (!c.saf) return;
    var fine = R(c.saf.amountM * (cl.finePct || 0.1));
    c.budget -= fine; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.spentM = (c.finc.spentM || 0) + fine;
    c.saf.strikes = (c.saf.strikes || 0) + 1; sat(c, -15, "cláusula descumprida: " + clauseText(c, cl));
    c.confidence = Math.max(0, (c.confidence == null ? 50 : c.confidence) - 10);
    note(c, { icon: "⚠️", title: "Cláusula da SAF descumprida", news: true, text: why + " " + c.saf.investor + " aplicou multa de " + money(c, fine) + " (" + c.saf.strikes + "ª advertência de " + c.saf.patience + ")." });
    if (c.saf.strikes >= (c.saf.patience || 2) || c.saf.sat <= 0) breakSaf(c, "descumprimento das contrapartidas");
  }
  function breakSaf(c, why) {
    if (!c.saf) return;
    var out = R(c.saf.amountM * 0.2);
    c.budget -= out; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.spentM = (c.finc.spentM || 0) + out; c.confidence = Math.max(0, (c.confidence == null ? 50 : c.confidence) - 15);
    note(c, { icon: "💥", title: "SAF rompida", news: true, text: c.saf.investor + " deixou o clube por " + why + ", levando " + money(c, out) + " de volta. A diretoria está furiosa." });
    post(c, "💥", "Crise", c.saf.investor + " rompe a SAF com o " + club(c).name + ".");
    c.safEnded = { investor: c.saf.investor, season: season(c) }; c.saf = null;
  }
  function clauseOf(c, id) { return (c.saf && c.saf.clauses || []).filter(function (x) { return x.id === id; })[0]; }

  /* ---------- eventos "na hora" (por negócio registrado) ---------- */
  function markDealsSeen(c) { (c.deals || []).forEach(function (d) { d._saf = 1; }); }
  function newDeals(c) { var out = []; for (var i = 0; i < (c.deals || []).length; i++) { var d = c.deals[i]; if (d._saf) break; out.push(d); } return out; }
  function checkDeal(c, d) {
    var p = TM.data.player(d.pid) || {}; var fee = d.fee || 0; var m = mult(c); var val = mv(p) * m;
    var cl;
    if (d.type === "out") {
      if ((cl = clauseOf(c, "simbolo")) && cl.pid === d.pid) penalty(c, cl, "Você vendeu " + (d.name || "o jogador-símbolo") + ".");
      if ((cl = clauseOf(c, "capitao")) && cl.pid === d.pid) penalty(c, cl, "Você vendeu o capitão " + (d.name || "") + ".");
      if ((cl = clauseOf(c, "nao_vender_abaixo")) && d.kind === "sale" && val > 0 && fee < val * 0.95) penalty(c, cl, "Você vendeu " + d.name + " por " + money(c, fee) + ", abaixo do valor de mercado (" + money(c, R(val)) + ").");
      if ((cl = clauseOf(c, "nao_vender_sub21")) && d.kind === "sale" && ageOf(p) <= 21 && p.id) penalty(c, cl, "Você vendeu " + d.name + ", de " + ageOf(p) + " anos.");
      if (d.kind === "sale") sat(c, fee >= val ? 3 : -2, "venda de " + d.name);
    } else if (d.type === "in") {
      if ((cl = clauseOf(c, "teto_contratacao")) && fee > cl.m) penalty(c, cl, "Você contratou " + d.name + " por " + money(c, fee) + ", acima do teto de " + money(c, cl.m) + ".");
      if ((cl = clauseOf(c, "sem_30")) && p.id && ageOf(p) >= 30 && d.kind !== "loan") penalty(c, cl, "Você contratou " + d.name + ", de " + ageOf(p) + " anos.");
      if (d.kind !== "loan") sat(c, 2, "contratação de " + d.name);
    }
  }
  function onOfferRejected(c, player, fee, buyerId) {
    if (!c.saf || !player) return;
    var val = mv(player) * mult(c); var cl;
    var euro = false; try { var b = TM.data.club(buyerId); euro = b && (C().REGION || {})[b.leagueId] === "eu"; } catch (e) {}
    if ((cl = clauseOf(c, "aceitar_europa")) && euro && fee >= val) penalty(c, cl, "Você recusou " + money(c, fee) + " de um clube europeu por " + player.name + ".");
    if ((cl = clauseOf(c, "aceitar_dobro")) && fee >= val * 2) penalty(c, cl, "Você recusou " + money(c, fee) + " por " + player.name + " (o dobro do valor).");
    if ((cl = clauseOf(c, "aceitar_30")) && ageOf(player) >= 30 && fee >= val) penalty(c, cl, "Você recusou " + money(c, fee) + " por " + player.name + ", de " + ageOf(player) + " anos.");
    if ((cl = clauseOf(c, "aceitar_reserva")) && fee >= val) { var rank = roster(c).slice().sort(function (a, b) { return b.overall - a.overall; }).map(function (x) { return x.id; }).indexOf(player.id); if (rank >= 14) penalty(c, cl, "Você recusou " + money(c, fee) + " pelo reserva " + player.name + "."); }
    sat(c, -1, "proposta recusada por " + player.name);
  }
  function onPlayerSold(c, player, fee, buyerId) { /* tratado via registro de negócios (checkDeal) */ }
  function onLoanTaken(c) { var cl = clauseOf(c, "sem_emprestimo"); if (cl) penalty(c, cl, "Você pegou um empréstimo bancário durante a SAF."); }
  function onLeave(c) { var cl = clauseOf(c, "permanencia"); if (cl) penalty(c, cl, "Você pediu para deixar o clube durante a SAF."); }

  /* ---------- resultados (forma) ---------- */
  function checkForm(c) {
    var st = c.stats || { p: 0 }; var seen = c.saf.formSeen || 0; var played = st.p || 0;
    if (played <= seen) return;
    var form = (c.recentForm || []).slice(-(played - seen));
    form.forEach(function (r) {
      if (r === "V") { sat(c, 1, null); c.saf.curUnbeaten = (c.saf.curUnbeaten || 0) + 1; c.saf.lossStreak = 0; }
      else if (r === "E") { c.saf.curUnbeaten = (c.saf.curUnbeaten || 0) + 1; c.saf.lossStreak = 0; }
      else { sat(c, -2, null); c.saf.curUnbeaten = 0; c.saf.lossStreak = (c.saf.lossStreak || 0) + 1; }
      c.saf.bestUnbeaten = Math.max(c.saf.bestUnbeaten || 0, c.saf.curUnbeaten || 0);
    });
    c.saf.formSeen = played;
    var cl = clauseOf(c, "sem_4_derrotas");
    if (cl && (c.saf.lossStreak || 0) >= 4 && !c.saf.streakFined) { c.saf.streakFined = 1; penalty(c, cl, "O time perdeu 4 jogos seguidos."); }
    if ((c.saf.lossStreak || 0) < 4) c.saf.streakFined = 0;
  }

  /* ---------- eventos interativos do investidor ---------- */
  var EVENTS = [
    { id: "aporte_extra", title: "Aporte extra com condição", when: function (c) { return true; },
      make: function (c) { var v = R(c.saf.amountM * (0.25 + Math.random() * 0.25)); var cl = pickClauses(c, typeOf(c.saf.type), 1, c.saf.clauses).filter(function (x) { return x.id !== "meta"; })[0]; return cl ? { v: v, cl: cl } : null; },
      text: function (c, e) { return c.saf.investor + " oferece um aporte extra de " + money(c, e.v) + " agora, em troca de uma nova contrapartida: " + e.cl.text + "."; },
      options: function (c, e) { return [
        { label: "✅ Aceitar o aporte", fn: function () { c.budget += e.v; c.finc.safM = (c.finc.safM || 0) + e.v; c.saf.amountM += e.v; c.saf.clauses.push(e.cl); sat(c, 6, "aporte extra aceito"); return "Aporte de " + money(c, e.v) + " recebido. Nova contrapartida: " + e.cl.text + "."; } },
        { label: "Recusar", fn: function () { sat(c, -3, "aporte extra recusado"); return "Você recusou. O investidor entendeu, mas ficou um pouco frustrado."; } } ]; } },
    { id: "reforco", title: "Exigência de reforço", when: function (c) { return true; },
      make: function (c) { var cl = makeClause(c, "reforco_posicao"); return cl ? { cl: cl } : null; },
      text: function (c, e) { return c.saf.investor + " quer um reforço específico: " + e.cl.text.toLowerCase() + ". Se você aceitar, vira contrapartida da temporada."; },
      options: function (c, e) { return [
        { label: "✅ Aceitar a exigência", fn: function () { c.saf.clauses.push(e.cl); sat(c, 5, "exigência de reforço aceita"); return "Nova contrapartida: " + e.cl.text + "."; } },
        { label: "Negociar: não é prioridade", fn: function () { sat(c, -6, "exigência de reforço rejeitada"); return "O investidor aceitou a explicação, mas anotou. Satisfação em queda."; } } ]; } },
    { id: "venda_sugerida", title: "Comprador encontrado", when: function (c) { return roster(c).length > 18; },
      make: function (c) { var r = roster(c).slice().sort(function (a, b) { return b.overall - a.overall; }); var cands = r.slice(3, 16).filter(function (p) { return mv(p) > 0; }); var p = cands.length ? pick(cands) : null; if (!p) return null; var fee = R(mv(p) * mult(c) * (1.25 + Math.random() * 0.35)); return { pid: p.id, pname: p.name, fee: fee }; },
      text: function (c, e) { return c.saf.investor + " encontrou um comprador para " + e.pname + ": " + money(c, e.fee) + ", acima do valor de mercado. Quer fechar agora?"; },
      options: function (c, e) { return [
        { label: "💸 Vender por " + money(c, e.fee), fn: function () { var p = C().resolvePlayer(c, e.pid); if (!p || c.roster.indexOf(e.pid) < 0) return "O jogador já não está no elenco."; c.budget += e.fee; c.finc.soldM = (c.finc.soldM || 0) + e.fee; C().logDeal(c, { type: "out", kind: "sale", pid: e.pid, name: p.name, pos: p.pos, ov: p.overall, fee: e.fee, other: "via investidor" }); c.roster = c.roster.filter(function (id) { return id !== e.pid; }); if (c.lineup) { c.lineup.starters = c.lineup.starters.filter(function (id) { return id !== e.pid; }); c.lineup.bench = c.lineup.bench.filter(function (id) { return id !== e.pid; }); } try { C().syncLineup(c); } catch (x) {} markDealsSeen(c); sat(c, 8, "venda sugerida aceita: " + p.name); return p.name + " vendido por " + money(c, e.fee) + "."; } },
        { label: "Manter o jogador", fn: function () { sat(c, -5, "venda sugerida recusada"); return "Você manteve " + e.pname + ". O investidor queria o lucro."; } } ]; } },
    { id: "prioridade", title: "Reunião de prioridades", when: function (c) { return true; },
      make: function (c) { return {}; },
      text: function (c) { return c.saf.investor + " chamou uma reunião para alinhar a prioridade da temporada. Sua escolha muda o que o investidor cobra."; },
      options: function (c) { return [
        { label: "🏆 Resultados em campo", fn: function () { swapClause(c, "esportivo"); sat(c, 4, "prioridade: resultados"); return "Prioridade definida: resultados. Uma contrapartida foi trocada por uma esportiva."; } },
        { label: "🌱 Base e valorização", fn: function () { swapClause(c, "elenco"); sat(c, 4, "prioridade: base"); return "Prioridade definida: base e valorização. Uma contrapartida foi trocada por uma de elenco."; } },
        { label: "💰 Finanças", fn: function () { swapClause(c, "receita"); sat(c, 4, "prioridade: finanças"); return "Prioridade definida: finanças. Uma contrapartida foi trocada por uma de receita."; } } ]; } },
    { id: "ultimato", title: "Ultimato do investidor", when: function (c) { return (c.saf.lossStreak || 0) >= 3; },
      make: function (c) { return { n: 3 }; },
      text: function (c, e) { return "Após " + (c.saf.lossStreak || 3) + " derrotas seguidas, " + c.saf.investor + " exige reação: ao menos 4 pontos nos próximos " + e.n + " jogos, ou vem advertência."; },
      options: function (c, e) { return [
        { label: "Aceitar o desafio", fn: function () { c.saf.ultimatum = { from: (c.stats && c.stats.p) || 0, n: e.n, need: 4 }; return "Ultimato aceito: 4 pontos nos próximos " + e.n + " jogos."; } },
        { label: "Pedir calma", fn: function () { sat(c, -8, "pediu calma no ultimato"); return "O investidor não gostou da resposta."; } } ]; } },
    { id: "participacao", title: "Investidor quer mais participação", when: function (c) { return c.saf.pct <= 70; },
      make: function (c) { var v = R(c.saf.amountM * 0.35); return { v: v, add: 10 }; },
      text: function (c, e) { return c.saf.investor + " oferece " + money(c, e.v) + " para aumentar sua participação em " + e.add + " pontos percentuais (de " + c.saf.pct + "% para " + (c.saf.pct + e.add) + "%)."; },
      options: function (c, e) { return [
        { label: "✅ Aceitar " + money(c, e.v), fn: function () { c.budget += e.v; c.finc.safM = (c.finc.safM || 0) + e.v; c.saf.amountM += e.v; c.saf.pct += e.add; sat(c, 6, "participação ampliada"); return "Participação do investidor agora é de " + c.saf.pct + "%."; } },
        { label: "Recusar", fn: function () { sat(c, -2, "ampliação recusada"); return "Você manteve a participação atual."; } } ]; } },
    { id: "veto", title: "Freio nos gastos", when: function (c) { return inDeals(c).length >= 2; },
      make: function (c) { var cl = makeClause(c, "gasto_max"); var taxa = R(c.saf.amountM * 0.05); return cl ? { cl: cl, taxa: taxa } : null; },
      text: function (c, e) { return c.saf.investor + " quer frear os gastos: " + e.cl.text.toLowerCase() + ". Você pode aceitar ou pagar uma taxa de autonomia de " + money(c, e.taxa) + " para manter liberdade."; },
      options: function (c, e) { return [
        { label: "Aceitar o teto", fn: function () { c.saf.clauses.push(e.cl); sat(c, 4, "teto de gastos aceito"); return "Nova contrapartida: " + e.cl.text + "."; } },
        { label: "Pagar " + money(c, e.taxa) + " pela autonomia", fn: function () { if (c.budget < e.taxa) return "Caixa insuficiente para pagar a taxa."; c.budget -= e.taxa; c.finc.spentM = (c.finc.spentM || 0) + e.taxa; sat(c, 1, "taxa de autonomia paga"); return "Autonomia mantida. Taxa de " + money(c, e.taxa) + " paga."; } } ]; } },
    { id: "amistoso", title: "Turnê comercial", when: function (c) { return true; },
      make: function (c) { var v = R(Math.max(1, c.saf.amountM * 0.08)); return { v: v }; },
      text: function (c, e) { return c.saf.investor + " fechou um amistoso comercial no exterior que rende " + money(c, e.v) + ", mas cansa o elenco (moral cai um pouco)."; },
      options: function (c, e) { return [
        { label: "✈️ Aceitar a turnê", fn: function () { c.budget += e.v; c.finc.bonusM = (c.finc.bonusM || 0) + e.v; c.moraleAdj = (c.moraleAdj || 0) - 4; sat(c, 5, "turnê comercial aceita"); return "Turnê feita: +" + money(c, e.v) + ". Moral do elenco −4."; } },
        { label: "Recusar", fn: function () { sat(c, -4, "turnê recusada"); return "Você recusou a turnê."; } } ]; } },
    { id: "bonus_lider", title: "Bônus por desempenho", when: function (c) { return pos(c) <= 3 && (c.stats && c.stats.p - (c.saf.statsAt.p || 0)) >= 8; },
      make: function (c) { return { v: R(c.saf.amountM * 0.1) }; },
      text: function (c, e) { return "Satisfeito com a campanha, " + c.saf.investor + " libera um bônus de " + money(c, e.v) + " para o clube."; },
      options: function (c, e) { return [ { label: "🎉 Receber", fn: function () { c.budget += e.v; c.finc.safM = (c.finc.safM || 0) + e.v; sat(c, 3, "bônus por desempenho"); return "+" + money(c, e.v) + " no caixa."; } } ]; } },
    { id: "cobranca", title: "Cobrança por resultados", when: function (c) { return c.saf.sat < 30; },
      make: function (c) { return {}; },
      text: function (c) { return c.saf.investor + " está insatisfeito (" + c.saf.sat + "/100). Diz que, sem mudança, rompe o contrato. Como você responde?"; },
      options: function (c) { return [
        { label: "Prometer reação (meta: 2 vitórias nos próximos 3 jogos)", fn: function () { c.saf.ultimatum = { from: (c.stats && c.stats.p) || 0, n: 3, need: 6 }; return "Promessa registrada: 6 pontos nos próximos 3 jogos."; } },
        { label: "Devolver 10% do aporte para acalmar", fn: function () { var v = R(c.saf.amountM * 0.1); if (c.budget < v) return "Caixa insuficiente."; c.budget -= v; c.finc.spentM = (c.finc.spentM || 0) + v; sat(c, 15, "devolveu 10% do aporte"); return "Você devolveu " + money(c, v) + ". Satisfação subiu."; } } ]; } },
    { id: "jovem", title: "Aposta na base", when: function (c) { return homegrownCount(c) > 0; },
      make: function (c) { var cl = makeClause(c, "crias"); return cl ? { cl: cl } : null; },
      text: function (c, e) { return c.saf.investor + " quer compromisso com a base: " + e.cl.text.toLowerCase() + ". Em troca, paga um bônus de " + money(c, R(c.saf.amountM * 0.06)) + " ao fim da temporada se cumprir."; },
      options: function (c, e) { return [
        { label: "✅ Assumir o compromisso", fn: function () { e.cl.bonusM = R(c.saf.amountM * 0.06); c.saf.clauses.push(e.cl); sat(c, 4, "compromisso com a base"); return "Nova contrapartida: " + e.cl.text + "."; } },
        { label: "Recusar", fn: function () { sat(c, -3, "recusou compromisso com a base"); return "Você recusou."; } } ]; } }
  ];
  function swapClause(c, cat) {
    var cls = c.saf.clauses; var idx = -1;
    for (var i = cls.length - 1; i >= 0; i--) { if (cls[i].id !== "meta" && cls[i].cat !== cat) { idx = i; break; } }
    var t = typeOf(c.saf.type); var pool = Object.keys(CAT).filter(function (id) { return CAT[id].cat === cat && !cls.some(function (x) { return x.id === id; }); });
    var tries = 0, nc = null; while (!nc && tries++ < 20 && pool.length) { nc = makeClause(c, pick(pool)); }
    if (nc) { if (idx >= 0) cls[idx] = nc; else cls.push(nc); }
  }
  function maybeEvent(c) {
    if (!c.saf) return;
    var d = day(c);
    // pedido pendente expirado?
    var pend = (c.notifications || []).filter(function (n) { return n.safEvent; });
    pend.forEach(function (n) { if (d - (n.safEvent.day || 0) > 35) { TM.notify.remove(c, n.id); c.saf.ignored = (c.saf.ignored || 0) + 1; sat(c, -8, "pedido sem resposta: " + n.safEvent.title); note(c, { icon: "😤", title: "Investidor ignorado", text: c.saf.investor + " não recebeu resposta sobre \"" + n.safEvent.title + "\" e ficou insatisfeito." }); } });
    if (pend.length) return;
    // ultimato em andamento
    if (c.saf.ultimatum) {
      var u = c.saf.ultimatum, played = (c.stats && c.stats.p) || 0;
      if (played >= u.from + u.n) {
        var form = (c.recentForm || []).slice(-(u.n)); var pts = form.reduce(function (s, r) { return s + (r === "V" ? 3 : r === "E" ? 1 : 0); }, 0);
        c.saf.ultimatum = null;
        if (pts >= u.need) { sat(c, 10, "ultimato cumprido"); note(c, { icon: "👏", title: "Ultimato cumprido", text: "O time respondeu com " + pts + " pontos. " + c.saf.investor + " ficou satisfeito." }); }
        else { note(c, { icon: "⚠️", title: "Ultimato descumprido", text: "Só " + pts + " ponto(s) nos últimos " + u.n + " jogos." }); penalty(c, { id: "ultimato", finePct: 0.05 }, "O ultimato do investidor não foi cumprido."); }
      }
    }
    if (d < (c.saf.nextEventDay || 0)) return;
    var pool = EVENTS.filter(function (e) { try { return e.when(c); } catch (x) { return false; } });
    // eventos de pressão têm prioridade quando cabem
    var urgent = pool.filter(function (e) { return e.id === "ultimato" || e.id === "cobranca" || e.id === "bonus_lider"; });
    var ev = urgent.length ? pick(urgent) : pick(pool);
    if (!ev) { c.saf.nextEventDay = d + 25; return; }
    var params = null; try { params = ev.make(c); } catch (x) { params = null; }
    c.saf.nextEventDay = d + 22 + rnd(24); c.saf.events = (c.saf.events || 0) + 1;
    if (!params) return;
    note(c, { icon: "💼", title: "SAF: " + ev.title, safEvent: { id: ev.id, title: ev.title, params: params, day: d }, text: ev.text(c, params) + " Toque para responder." });
  }

  /* ---------- tick (a cada visita ao hub) e fim de temporada ---------- */
  function tick(c) {
    if (!c) return;
    migrate(c);
    maybeOffer(c);
    if (!c.saf) return;
    newDeals(c).forEach(function (d) { if (c.saf) checkDeal(c, d); });
    markDealsSeen(c);
    if (c.saf) checkForm(c);
    if (c.saf) maybeEvent(c);
    if (c.saf && c.saf.sat <= 0) breakSaf(c, "insatisfação total");
  }
  function seasonEnd(c) {
    if (!c.saf) return;
    var fails = [], oks = 0, bonusExtra = 0;
    c.saf.clauses.forEach(function (cl) {
      var t = CAT[cl.id]; if (!t || t.when !== "season" || !t.check) return;
      var r; try { r = t.check(c, cl); } catch (e) { r = { ok: true }; }
      if (r.ok) { oks++; if (cl.bonusM) bonusExtra += cl.bonusM; } else fails.push({ cl: cl, why: r.why || "Contrapartida não cumprida." });
    });
    if (!fails.length) {
      var bonus = R(c.saf.amountM * (c.saf.bonusPct || 0.15)) + bonusExtra;
      c.budget += bonus; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.safM = (c.finc.safM || 0) + bonus;
      c.confidence = Math.min(100, (c.confidence == null ? 50 : c.confidence) + 8); sat(c, 15, "temporada aprovada");
      note(c, { icon: "💼", title: "Contrapartidas cumpridas", news: true, text: c.saf.investor + " aprovou a temporada e liberou um aporte extra de " + money(c, bonus) + "." });
    } else {
      fails.forEach(function (f) { if (c.saf) penalty(c, f.cl, f.why); });
      if (c.saf && oks) sat(c, oks * 3, oks + " contrapartida(s) cumprida(s)");
    }
    if (!c.saf) return;
    // fim do prazo do contrato?
    if (season(c) - c.saf.season + 1 >= (c.saf.term || 4)) {
      note(c, { icon: "🤝", title: "SAF encerrada", news: true, text: "O prazo de " + c.saf.term + " temporadas de " + c.saf.investor + " terminou. O investidor mantém a participação sem novas contrapartidas." });
      c.safEnded = { investor: c.saf.investor, season: season(c), done: true }; c.saf = null; return;
    }
    // nova temporada: zera referências e sorteia 1 cláusula nova no lugar da mais antiga (mantém a meta)
    var st = c.stats || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    c.saf.statsAt = { p: st.p, w: st.w, d: st.d, l: st.l, gf: st.gf, ga: st.ga }; c.saf.honoursAt = (c.honours || []).length; c.saf.classicoAt = c.classicoLoss || 0;
    c.saf.bestUnbeaten = 0; c.saf.curUnbeaten = 0; c.saf.formSeen = st.p || 0; c.saf.ignored = 0;
    c.saf.clauses = c.saf.clauses.map(function (cl) { if (cl.id === "meta") { var m = makeClause(c, "meta"); return m || cl; } return cl; });
    var other = c.saf.clauses.filter(function (x) { return x.id !== "meta"; });
    if (other.length) { var old = other[0]; var nc = pickClauses(c, typeOf(c.saf.type), 2, c.saf.clauses).filter(function (x) { return x.id !== "meta"; })[0]; if (nc) { c.saf.clauses = c.saf.clauses.filter(function (x) { return x !== old; }); c.saf.clauses.push(nc); note(c, { icon: "📝", title: "Contrapartidas renovadas", text: c.saf.investor + " trocou \"" + clauseText(c, old) + "\" por \"" + nc.text + "\" para a nova temporada." }); } }
  }
  // converte SAF salva na versão antiga
  function migrate(c) {
    if (c.saf && c.saf.patience == null) {
      var st = c.stats || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
      c.saf.type = c.saf.type || "fundo"; c.saf.patience = 2; c.saf.sat = 60; c.saf.term = 4; c.saf.bonusPct = 0.15; c.saf.events = 0; c.saf.ignored = 0;
      c.saf.statsAt = { p: st.p, w: st.w, d: st.d, l: st.l, gf: st.gf, ga: st.ga }; c.saf.classicoAt = c.classicoLoss || 0; c.saf.bestUnbeaten = 0; c.saf.curUnbeaten = 0; c.saf.formSeen = st.p || 0;
      c.saf.nextEventDay = day(c) + 15; c.saf.log = c.saf.log || [];
      var map = { euro: "aceitar_europa", jovens: "sub21", reforcos: "investir_aporte", semEmprestimo: "sem_emprestimo" };
      c.saf.clauses = (c.saf.clauses || []).map(function (cl) { var id = map[cl.id] || cl.id; var nc = makeClause(c, id) || cl; if (cl.pid) { nc.pid = cl.pid; nc.pname = cl.pname; } return nc; });
      markDealsSeen(c);
    }
    if (c.safOffer && c.safOffer.type == null) { c.safOffer.type = "fundo"; c.safOffer.term = 4; c.safOffer.bonusPct = 0.15; c.safOffer.clauses = (c.safOffer.clauses || []).map(function (cl) { return makeClause(c, cl.id) || cl; }); }
  }

  /* ---------- UI: cartão no hub / finanças ---------- */
  function satInfo(s) { return s >= 75 ? { cls: "good", txt: "muito satisfeito" } : s >= 50 ? { cls: "ok", txt: "satisfeito" } : s >= 30 ? { cls: "warn", txt: "impaciente" } : { cls: "bad", txt: "prestes a romper" }; }
  function card(c, route) {
    if (c.safOffer) {
      var o = c.safOffer;
      return el("div", { class: "saf-card clickable", on: { click: function () { TM.ui.go("club-saf-offer", { from: route }); } } }, [
        el("div", { class: "saf-title", text: "💼 Proposta de SAF — " + o.investor }),
        el("div", { class: "saf-text", text: o.pct + "% do clube por " + money(c, o.amountM) + " · " + o.clauses.length + " contrapartidas · responda até o fim da " + (o.windowName || "janela") + "." }),
        el("div", { class: "note-actions" }, [ TM.ui.button("Ver proposta completa", function () { TM.ui.go("club-saf-offer", { from: route }); }, "btn primary small") ])
      ]);
    }
    if (c.saf) {
      var si = satInfo(c.saf.sat == null ? 60 : c.saf.sat);
      return el("div", { class: "saf-card compact clickable", on: { click: function () { TM.ui.go("club-saf", { from: route }); } } }, [
        el("div", { class: "saf-title", text: "💼 SAF · " + c.saf.investor + " (" + c.saf.pct + "%)" }),
        el("div", { class: "saf-sat" }, [ el("div", { class: "saf-sat-fill sat-" + si.cls, style: "width:" + (c.saf.sat || 0) + "%" }) ]),
        el("div", { class: "saf-text", text: "Investidor " + si.txt + " · " + (c.saf.strikes || 0) + "/" + c.saf.patience + " advertências · " + c.saf.clauses.length + " contrapartidas. Toque para abrir o painel." })
      ]);
    }
    return null;
  }
  function clauseRow(c, cl, live) {
    var t = CAT[cl.id]; var status = null;
    if (live && t && t.when === "season" && t.check) { try { var r = t.check(c, cl); status = r.ok ? "✔ em dia" : "⚠ em risco: " + r.why; } catch (e) {} }
    else if (t && t.when === "event") status = "⚡ vale na hora";
    return el("li", { class: "saf-cl" }, [
      el("span", { class: "saf-cl-ic", text: CAT_ICON[cl.cat] || "•" }),
      el("span", { class: "saf-cl-tx" }, [ el("span", { text: clauseText(c, cl) + " (multa " + Math.round((cl.finePct || 0.1) * 100) + "%)" }), status ? el("span", { class: "saf-cl-st" + (status.indexOf("⚠") === 0 ? " bad" : ""), text: status }) : null ])
    ]);
  }
  function clauseList(c, clauses, live) {
    var byCat = {}; (clauses || []).forEach(function (cl) { (byCat[cl.cat || "outros"] = byCat[cl.cat || "outros"] || []).push(cl); });
    var wrap = el("div", { class: "saf-cl-groups" });
    CAT_ORDER.concat(["outros"]).forEach(function (cat) { if (!byCat[cat]) return; wrap.appendChild(el("div", { class: "saf-cl-cat", text: CAT_LABEL[cat] || cat })); wrap.appendChild(el("ul", { class: "saf-clauses" }, byCat[cat].map(function (cl) { return clauseRow(c, cl, live); }))); });
    return wrap;
  }

  /* ---------- tela: proposta completa ---------- */
  TM.ui.register("club-saf-offer", function (screen, params) {
    var c = TM.storage.coachCareer(); var from = (params && params.from) || "coach-hub";
    if (!c) { TM.ui.go("modes"); return; }
    migrate(c);
    screen.appendChild(TM.ui.topbar("💼 Proposta de SAF", function () { TM.ui.go(from); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    var o = c.safOffer;
    if (!o) { body.appendChild(el("p", { class: "intro-text", text: "Não há proposta de SAF em aberto no momento." })); return; }
    var t = typeOf(o.type); var s = o.size == null ? clubSize(c) : o.size;
    body.appendChild(el("div", { class: "saf-hero" }, [
      el("div", { class: "saf-hero-name", text: o.investor }),
      el("div", { class: "saf-hero-type", text: t.label + " · " + t.desc }),
      el("div", { class: "saf-hero-grid" }, [
        el("div", { class: "saf-kpi" }, [ el("div", { class: "saf-kpi-v", text: money(c, o.amountM) }), el("div", { class: "saf-kpi-l", text: "aporte no caixa" }) ]),
        el("div", { class: "saf-kpi" }, [ el("div", { class: "saf-kpi-v", text: o.pct + "%" }), el("div", { class: "saf-kpi-l", text: "do clube" }) ]),
        el("div", { class: "saf-kpi" }, [ el("div", { class: "saf-kpi-v", text: o.term + " temp." }), el("div", { class: "saf-kpi-l", text: "prazo" }) ]),
        el("div", { class: "saf-kpi" }, [ el("div", { class: "saf-kpi-v", text: "+" + Math.round((o.bonusPct || 0.15) * 100) + "%" }), el("div", { class: "saf-kpi-l", text: "bônus/temporada se cumprir tudo" }) ])
      ])
    ]));
    body.appendChild(el("p", { class: "intro-text", text: "Por que agora: " + club(c).name + " é um " + sizeLabel(s) + (c.budget < 0 ? " com o caixa no vermelho" : "") + ", e investidores enxergam espaço para crescer. Paciência do investidor: " + t.patience + " advertências antes de romper (levando 20% do aporte de volta). Prazo de resposta: até o fim da " + (o.windowName || "janela") + "." }));
    body.appendChild(el("div", { class: "list-head", text: "Contrapartidas (" + o.clauses.length + ")" }));
    body.appendChild(clauseList(c, o.clauses, false));
    body.appendChild(el("div", { class: "list-head", text: "Como o investidor age" }));
    body.appendChild(el("div", { class: "coin-rules" }, [
      el("div", { class: "coin-rule" }, [ el("span", { class: "coin-rule-ic", text: "📈" }), el("span", { class: "coin-rule-tx", text: "Satisfação sobe com vitórias, vendas com lucro e pedidos atendidos; cai com derrotas e recusas." }) ]),
      el("div", { class: "coin-rule" }, [ el("span", { class: "coin-rule-ic", text: "📨" }), el("span", { class: "coin-rule-tx", text: "Ele manda pedidos nas notificações: reforços, vendas, aportes extras, reuniões, ultimatos." }) ]),
      el("div", { class: "coin-rule" }, [ el("span", { class: "coin-rule-ic", text: "🧾" }), el("span", { class: "coin-rule-tx", text: "No painel da SAF você pede aporte, renegocia cláusulas, recompra participação ou encerra o acordo." }) ])
    ]));
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("✅ Aceitar " + money(c, o.amountM) + " por " + o.pct + "%", function () { TM.ui.confirm("Aceitar a SAF?", o.investor + " passa a ter " + o.pct + "% do clube em troca de " + money(c, o.amountM) + " e das " + o.clauses.length + " contrapartidas.", "Aceitar", function () { accept(c, from); }); }, "btn primary big"),
      o.counter ? null : TM.ui.button("🤝 Contraproposta: menos participação (−10 pontos)", function () { counter(c, "pct", "club-saf-offer"); }, "btn"),
      o.counter ? null : TM.ui.button("🤝 Contraproposta: mais dinheiro (+20%)", function () { counter(c, "money", "club-saf-offer"); }, "btn"),
      TM.ui.button("Recusar", function () { TM.ui.confirm("Recusar a proposta?", "O investidor pode não voltar tão cedo.", "Recusar", function () { reject(c, from); }, true); }, "btn ghost")
    ]));
  });

  /* ---------- tela: painel da SAF ---------- */
  TM.ui.register("club-saf", function (screen, params) {
    var c = TM.storage.coachCareer(); var from = (params && params.from) || "coach-hub";
    if (!c) { TM.ui.go("modes"); return; }
    migrate(c);
    screen.appendChild(TM.ui.topbar("💼 SAF", function () { TM.ui.go(from); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    if (!c.saf) {
      body.appendChild(el("p", { class: "intro-text", text: c.safOffer ? "Há uma proposta em aberto." : "O clube não tem investidor no momento. Clubes pequenos e de divisões menores recebem propostas com mais frequência; gigantes, raramente." }));
      if (c.safOffer) body.appendChild(TM.ui.button("Ver proposta", function () { TM.ui.go("club-saf-offer", { from: from }); }, "btn primary"));
      body.appendChild(el("div", { class: "setting-hint", text: "Tamanho do clube: " + sizeLabel(clubSize(c)) + " (" + clubSize(c) + "/100) · chance por janela: " + Math.round(offerChance(c) * 100) + "%." }));
      return;
    }
    var s = c.saf, t = typeOf(s.type), si = satInfo(s.sat == null ? 60 : s.sat);
    body.appendChild(el("div", { class: "saf-hero" }, [
      el("div", { class: "saf-hero-name", text: s.investor }),
      el("div", { class: "saf-hero-type", text: t.label + " · " + s.pct + "% do clube · desde a temporada " + s.season + " · prazo " + s.term + " temp." }),
      el("div", { class: "saf-sat big" }, [ el("div", { class: "saf-sat-fill sat-" + si.cls, style: "width:" + (s.sat || 0) + "%" }) ]),
      el("div", { class: "saf-text", text: "Satisfação " + (s.sat || 0) + "/100 · " + si.txt + " · " + (s.strikes || 0) + "/" + s.patience + " advertências · aportes " + money(c, s.amountM) })
    ]));
    if (s.ultimatum) body.appendChild(el("div", { class: "invite-banner declined" }, [ el("div", { class: "inv-txt", text: "⏳ Ultimato em andamento: " + s.ultimatum.need + " pontos nos próximos " + s.ultimatum.n + " jogos." }) ]));
    body.appendChild(el("div", { class: "list-head", text: "Contrapartidas (" + s.clauses.length + ") — situação agora" }));
    body.appendChild(clauseList(c, s.clauses, true));
    body.appendChild(el("div", { class: "list-head", text: "Falar com o investidor" }));
    var extraV = R(s.amountM * 0.2), renegV = R(s.amountM * 0.03), buyV = R(s.amountM / Math.max(1, s.pct) * 10 * 1.25), endV = R(s.amountM * 0.5);
    body.appendChild(el("div", { class: "coin-rules" }, [
      act("💸", "Pedir aporte extra de " + money(c, extraV), "O investidor topa se estiver satisfeito (50+), e acrescenta uma contrapartida.", function () {
        if ((s.sat || 0) < 50) { TM.ui.toast("O investidor não libera: satisfação abaixo de 50."); return; }
        var cl = pickClauses(c, t, 2, s.clauses).filter(function (x) { return x.id !== "meta"; })[0];
        TM.ui.confirm("Pedir " + money(c, extraV) + "?", "Em troca, nova contrapartida: " + (cl ? cl.text : "nenhuma") + ".", "Pedir", function () { c.budget += extraV; c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 }; c.finc.safM = (c.finc.safM || 0) + extraV; s.amountM += extraV; if (cl) s.clauses.push(cl); sat(c, -5, "pediu aporte extra"); note(c, { icon: "💸", title: "Aporte extra", text: s.investor + " liberou " + money(c, extraV) + (cl ? ". Nova contrapartida: " + cl.text : "") + "." }); save(c); TM.ui.go("club-saf", { from: from }); });
      }),
      act("📝", "Renegociar uma contrapartida (" + money(c, renegV) + ")", "Troca a contrapartida mais difícil por outra sorteada. Custa 3% do aporte.", function () {
        if (c.budget < renegV) { TM.ui.toast("Caixa insuficiente."); return; }
        var risky = s.clauses.filter(function (cl) { var tt = CAT[cl.id]; if (!tt || !tt.check) return false; try { return !tt.check(c, cl).ok; } catch (e) { return false; } });
        var old = risky[0] || s.clauses.filter(function (x) { return x.id !== "meta"; })[0]; if (!old) { TM.ui.toast("Nada para renegociar."); return; }
        var nc = pickClauses(c, t, 2, s.clauses).filter(function (x) { return x.id !== "meta"; })[0]; if (!nc) { TM.ui.toast("O investidor não tem alternativa."); return; }
        TM.ui.confirm("Renegociar?", "Sai: " + clauseText(c, old) + ". Entra: " + nc.text + ". Custo " + money(c, renegV) + ".", "Renegociar", function () { c.budget -= renegV; c.finc.spentM = (c.finc.spentM || 0) + renegV; s.clauses = s.clauses.filter(function (x) { return x !== old; }); s.clauses.push(nc); sat(c, -2, "renegociou contrapartida"); save(c); TM.ui.go("club-saf", { from: from }); });
      }),
      act("🔙", "Recomprar 10% por " + money(c, buyV), "Reduz a participação do investidor. Ele aceita com satisfação 40+.", function () {
        if ((s.sat || 0) < 40) { TM.ui.toast("O investidor não vende agora (satisfação < 40)."); return; }
        if (c.budget < buyV) { TM.ui.toast("Caixa insuficiente."); return; }
        TM.ui.confirm("Recomprar 10%?", "A participação de " + s.investor + " cai de " + s.pct + "% para " + (s.pct - 10) + "%. Custo " + money(c, buyV) + ".", "Recomprar", function () { c.budget -= buyV; c.finc.spentM = (c.finc.spentM || 0) + buyV; s.pct -= 10; note(c, { icon: "🔙", title: "Participação recomprada", text: "O clube recomprou 10% de " + s.investor + "." }); if (s.pct <= 0) { note(c, { icon: "🤝", title: "SAF encerrada", text: "O clube recomprou toda a participação de " + s.investor + "." }); c.safEnded = { investor: s.investor, season: season(c), done: true }; c.saf = null; } save(c); TM.ui.go("club-saf", { from: from }); });
      }),
      act("🚪", "Encerrar a SAF devolvendo " + money(c, endV), "Rompe o acordo por iniciativa do clube: devolve metade do aporte e perde as cláusulas.", function () {
        if (c.budget < endV) { TM.ui.toast("Caixa insuficiente para devolver."); return; }
        TM.ui.confirm("Encerrar a SAF?", "Você devolve " + money(c, endV) + " a " + s.investor + " e o acordo termina.", "Encerrar", function () { c.budget -= endV; c.finc.spentM = (c.finc.spentM || 0) + endV; note(c, { icon: "🚪", title: "SAF encerrada", news: true, text: "O clube encerrou o acordo com " + s.investor + " devolvendo " + money(c, endV) + "." }); post(c, "🚪", "SAF", club(c).name + " encerra a SAF com " + s.investor + "."); c.safEnded = { investor: s.investor, season: season(c), done: true }; c.saf = null; save(c); TM.ui.go(from); }, true);
      })
    ]));
    if (s.log && s.log.length) {
      body.appendChild(el("div", { class: "list-head", text: "Histórico com o investidor" }));
      var lg = el("div", { class: "coin-log" });
      s.log.slice(0, 20).forEach(function (L) { lg.appendChild(el("div", { class: "coin-log-row" }, [ el("span", { class: "coin-log-r", text: L.txt }), el("span", { class: "coin-log-t", text: "temp. " + L.season }) ])); });
      body.appendChild(lg);
    }
  });
  function act(ic, tx, hint, fn) {
    return el("button", { class: "coin-rule clickable saf-act", on: { click: fn } }, [ el("span", { class: "coin-rule-ic", text: ic }), el("span", { class: "coin-rule-tx" }, [ el("span", { text: tx }), el("span", { class: "saf-cl-st", text: hint }) ]), el("span", { class: "side-arrow", text: "→", style: "opacity:1" }) ]);
  }

  /* ---------- tela: responder a um pedido do investidor ---------- */
  TM.ui.register("club-saf-event", function (screen, params) {
    var c = TM.storage.coachCareer(); if (!c) { TM.ui.go("modes"); return; }
    var n = params && params.noteId ? TM.notify.get(c, params.noteId) : null;
    screen.appendChild(TM.ui.topbar("💼 Pedido do investidor", function () { TM.ui.go("coach-notifications"); }));
    var body = el("div", { class: "panel-narrow" }); screen.appendChild(body);
    if (!n || !n.safEvent || !c.saf) { body.appendChild(el("p", { class: "intro-text", text: "Este pedido não está mais em aberto." })); return; }
    var ev = EVENTS.filter(function (e) { return e.id === n.safEvent.id; })[0];
    if (!ev) { body.appendChild(el("p", { class: "intro-text", text: "Pedido inválido." })); return; }
    var e = n.safEvent.params || {};
    body.appendChild(el("div", { class: "saf-hero" }, [ el("div", { class: "saf-hero-name", text: ev.title }), el("div", { class: "saf-hero-type", text: c.saf.investor + " · satisfação " + (c.saf.sat || 0) + "/100" }) ]));
    body.appendChild(el("p", { class: "intro-text", text: ev.text(c, e) }));
    var opts = ev.options(c, e);
    body.appendChild(el("div", { class: "actions" }, opts.map(function (o, i) {
      return TM.ui.button(o.label, function () {
        c.finc = c.finc || { prizeM: 0, spentM: 0, soldM: 0 };
        var msg = ""; try { msg = o.fn() || ""; } catch (x) { msg = "Não foi possível concluir."; }
        TM.notify.remove(c, n.id); note(c, { icon: "💼", title: ev.title + " — resposta", text: msg });
        save(c); TM.ui.toast(msg.slice(0, 80)); TM.ui.go("coach-notifications");
      }, i === 0 ? "btn primary" : "btn");
    })));
  });

  TM.saf = { tick: tick, seasonEnd: seasonEnd, card: card, onOfferRejected: onOfferRejected, onPlayerSold: onPlayerSold, onLoanTaken: onLoanTaken, onLeave: onLeave,
    clubSize: clubSize, offerChance: offerChance, CAT: CAT, EVENTS: EVENTS, makeOffer: makeOffer, accept: accept, reject: reject, migrate: migrate, clauseList: clauseList };
})(window);
