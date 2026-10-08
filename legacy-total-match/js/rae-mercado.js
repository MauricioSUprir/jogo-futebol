/* ================= TOTAL MATCH — RUMO AO ESTRELATO: O MERCADO =================
   A transferência como jornada (pedido do dono: "mais imersão em transferência"):
   - a temporada tem começo e fim, com duas janelas (início e meio);
   - jogou bem, aparece olheiro no estádio e o nome sai na imprensa;
   - um empresário com nome e jeito próprio manda mensagem e dá conselho;
   - chegam propostas de compra, empréstimo, fim de contrato e renovação;
     dá para negociar (salário, luvas, garantia de titular), e o clube atual
     pode segurar você — aí só pedindo para sair, e isso tem preço;
   - fechou: exames, assinatura, número da camisa, coletiva e a apresentação
     no estádio novo, com a torcida reagindo;
   - a trajetória guarda todos os clubes, números e valores.
   Tudo fica em c.mercado (carreiras antigas ganham o mercado na primeira vez). */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var EUR_BRL = 6;                 // valor de mercado vem em euro; aqui tudo é em real

  function R() { return TM.rae; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rnd(a.length)]; }
  function chance(p) { return Math.random() < p; }
  function ic(nome) { return TM.ic ? TM.ic(nome) : ""; }
  function iniciais(n) { var a = String(n || "?").split(/\s+/); return ((a[0] || "")[0] || "") + ((a[a.length - 1] || "")[0] || ""); }
  function mil(v) { return Math.round(v / 1000) * 1000; }

  /* =============== dinheiro, valor e salário =============== */
  function fmtR(v) {
    var n = Math.abs(v || 0);
    if (n >= 1e6) { var m = n / 1e6; return "R$ " + (m < 10 ? m.toFixed(1).replace(".", ",") : Math.round(m)) + " mi"; }
    if (n >= 1e3) return "R$ " + Math.round(n / 1e3) + " mil";
    return "R$ " + Math.round(n);
  }
  // valor de mercado: a curva do jogo, mas garoto que ninguém viu jogar vale menos —
  // o preço sobe com a fama e com os jogos (vitrine)
  function jogosNaCarreira(c) {
    var M = c.mercado; if (!M) return 0;
    return (M.historico || []).reduce(function (s, h) { return s + (h.jogos || 0); }, 0) + ((M.clube && M.clube.jogos) || 0);
  }
  function valorDe(c) {
    var eur = 0.05;
    try { eur = TM.data.marketValue({ overall: c.overall, age: c.age, potential: c.potential, pos: c.pos }); } catch (e) {}
    var vis = clamp(0.3 + (c.fama || 0) / 90 + jogosNaCarreira(c) / 60, 0.3, 1);
    return Math.max(1e5, Math.round(eur * EUR_BRL * 1e6 * vis / 1e5) * 1e5);
  }
  function plural(n, um, varios) { return n + " " + (n === 1 ? um : varios); }
  var _nota = {};
  function notaClube(id) { if (_nota[id] == null) { try { _nota[id] = TM.data.clubRating(id) || 60; } catch (e) { _nota[id] = 60; } } return _nota[id]; }
  // salário por mês: cresce com a nota do jogador e com o tamanho do clube
  function salarioPara(ov, clubId) { return Math.max(3000, mil(9000 * Math.exp((ov - 50) / 11) * Math.pow(notaClube(clubId) / 70, 3))); }

  /* =============== o empresário =============== */
  var AGENTES = [
    { nome: "Rodrigo Valença", estilo: "agressivo" }, { nome: "Paula Menezes", estilo: "conectado" },
    { nome: "Jorge Tadeu", estilo: "cauteloso" }, { nome: "Bianca Albuquerque", estilo: "conectado" },
    { nome: "Fábio Caruso", estilo: "agressivo" }, { nome: "Lúcio Prates", estilo: "cauteloso" }
  ];
  var ESTILOS = {
    agressivo: { nome: "Agressivo", desc: "Aperta por salário e luvas. Às vezes estica demais a corda." },
    cauteloso: { nome: "Cauteloso", desc: "Não arrisca na negociação e prefere contrato longo." },
    conectado: { nome: "Bem relacionado", desc: "Conhece todo mundo: aparecem mais clubes de olho em você." }
  };

  /* =============== estado =============== */
  function m(c) {
    if (!c.mercado) {
      var ag = pick(AGENTES);
      c.mercado = {
        v: 1, inicio: c.rodada || 0, agente: { nome: ag.nome, estilo: ag.estilo },
        contrato: { ate: (c.seasonYear || 2026) + 2 + (c.age <= 19 ? 1 : 0), salario: salarioPara(c.overall, c.clubId) },
        interesse: {}, propostas: [], msgs: [], manchetes: [], historico: [], temporadas: [],
        clube: { jogos: 0, gols: 0, assist: 0, desde: c.seasonYear || 2026 },
        janelaAberta: false
      };
      msg(c, "agente", "Prazer, sou " + ag.nome + ", seu empresário. Joga bem que o telefone toca. Quando a janela abrir, eu te conto tudo o que chegar.");
      c.mercado.janelaAberta = janelaDe(c).aberta;
      try { if (R().salva) R().salva(c); } catch (e) {}   // carreira antiga: o mercado nasce e já fica salvo
    }
    return c.mercado;
  }
  function msg(c, de, t) {
    var M = c.mercado;
    M.msgs = ([{ de: de, t: t, r: c.rodada || 0, nova: true }]).concat(M.msgs || []).slice(0, 40);
  }
  function manchete(c, t) {
    var M = c.mercado;
    M.manchetes = ([{ t: t, r: c.rodada || 0, ano: c.seasonYear }]).concat(M.manchetes || []).slice(0, 24);
  }

  /* =============== temporada e janelas =============== */
  function tamanhoTemporada(c) {
    var lg = TM.data.league(c.leagueId), n = lg && lg.clubIds ? lg.clubIds.length : 20;
    return clamp((n - 1) * 2, 30, 38);
  }
  function rodadaTemp(c) { return (c.rodada || 0) - (m(c).inicio || 0); }   // jogos já feitos na temporada
  function janelaDe(c) {
    var M = c.mercado, rr = (c.rodada || 0) - ((M && M.inicio) || 0), T = tamanhoTemporada(c), meio = Math.floor(T / 2) - 2;
    if (rr < 4) return { aberta: true, nome: "Janela de início de temporada", fecha: 4 - rr };
    if (rr >= meio && rr < meio + 4) return { aberta: true, nome: "Janela do meio da temporada", fecha: meio + 4 - rr };
    return rr < meio ? { aberta: false, nome: "Janela do meio da temporada", abre: meio - rr }
                     : { aberta: false, nome: "Janela de início de temporada", abre: Math.max(1, T - rr) };
  }

  /* =============== quem está olhando =============== */
  // 0..1: o quanto o mercado está prestando atenção em você
  function vitrine(c) {
    var notas = (c.ratings || []).slice(0, 6);
    var media = notas.length ? notas.reduce(function (a, b) { return a + b; }, 0) / notas.length : 6.2;
    var s = (media - 6) / 2.2;
    s += (c.seasonGoals || 0) * (c.pos === "FW" ? 0.02 : 0.04);
    s += c.status === "intocavel" ? 0.25 : c.status === "titular" ? 0.15 : c.status === "alternativo" ? 0.05 : 0;
    s += Math.max(0, (c.potential || c.overall) - c.overall) * 0.008;
    s += (c.fama || 0) / 250;
    if (m(c).agente.estilo === "conectado") s += 0.1;
    return clamp(s, 0, 1);
  }
  function paisDe(leagueId) { var lg = TM.data.league(leagueId); return (lg && lg.nation) || ""; }
  // clubes que fariam sentido para você: no seu nível ou no do seu clube (quem joga bem num
  // clube grande atrai clube grande), de preferência do mesmo país — 2 em cada 3 vêm de casa
  function clubesNaFaixa(c, lo, hi) {
    var w = TM.data.world(), meu = notaClube(c.clubId), pais = paisDe(c.leagueId);
    if (c.status === "titular" || c.status === "intocavel" || (c.ratings || [])[0] >= 7.5) hi = Math.max(hi, meu + 6);
    function filtra() {
      return (w.clubs || []).filter(function (cl) {
        if (!cl || cl.id === c.clubId) return false;
        var r = notaClube(cl.id);
        return r >= lo && r <= hi;
      });
    }
    // o clube mais fraco do jogo tem força ~62: garoto de 55 ficaria sem ninguém na faixa.
    // A faixa abre até ter opções de verdade.
    var todos = filtra();
    for (var k = 0; todos.length < 8 && k < 10; k++) { lo -= 2; hi += 2; todos = filtra(); }
    var casa = todos.filter(function (cl) { return paisDe(cl.leagueId) === pais; });
    return casa.length && (chance(0.66) || casa.length === todos.length) ? casa : todos;
  }
  // onde você chegaria no clube: quantos estão na sua frente e quem é o dono da vaga
  function papelNoClube(c, clubId) {
    var fila = (TM.data.clubPlayers(clubId) || []).filter(function (p) { return p.pos === c.pos; })
      .sort(function (a, b) { return b.overall - a.overall; });
    var naFrente = fila.filter(function (p) { return p.overall > c.overall; }).length;
    var vagas = c.pos === "GK" ? 1 : c.pos === "FW" ? 2 : c.pos === "MF" ? 3 : 4;
    return { papel: naFrente < vagas ? "titular" : naFrente < vagas + 2 ? "rodizio" : "promessa", naFrente: naFrente, dono: fila[0] || null };
  }
  var PAPEL = { titular: "Titular", rodizio: "Rodízio", promessa: "Promessa" };
  var TIPO = { compra: "Compra", emprestimo: "Empréstimo", livre: "Fim de contrato", renovacao: "Renovação" };

  function montaProposta(c, cl, tipo) {
    var M = m(c), pp = papelNoClube(c, cl.id);
    var interesse = (M.interesse[cl.id] || { n: 20 }).n;
    var sal = mil(salarioPara(c.overall, cl.id) * (1 + Math.random() * 0.25));
    if (tipo === "renovacao") sal = Math.max(sal, mil(M.contrato.salario * 1.25));
    // quem quer te tirar de onde você está paga mais (empréstimo paga o de lá)
    if (tipo === "compra" || tipo === "livre") sal = Math.max(sal, mil(M.contrato.salario * (1.1 + Math.random() * 0.3)));
    var valor = valorDe(c);
    return {
      id: "p" + Date.now().toString(36) + rnd(1e5), clubId: cl.id, clubName: cl.name, tipo: tipo,
      papel: tipo === "renovacao" ? (c.status === "intocavel" || c.status === "titular" ? "titular" : c.status === "alternativo" ? "rodizio" : "promessa") : pp.papel,
      naFrente: pp.naFrente, salario: sal,
      anos: tipo === "emprestimo" ? 1 : clamp(2 + rnd(3) + (c.age <= 21 ? 1 : 0), 2, 5),
      taxa: tipo === "compra" ? Math.round(valor * (0.85 + Math.random() * 0.45) / 1e5) * 1e5 : 0,
      luvas: tipo === "emprestimo" ? 0 : mil(sal * (1 + rnd(3))),
      paciencia: 2 + (interesse >= 60 ? 1 : 0), interesse: interesse, status: "nova", r: c.rodada || 0, feito: []
    };
  }
  function ativas(c) { return (m(c).propostas || []).filter(function (p) { return p.status === "nova" || p.status === "negociando"; }); }

  function novasPropostas(c, noticias) {
    var M = m(c), abertas = ativas(c);
    if (abertas.length >= 3 || M.livre || M.emprestimo) return;
    var v = vitrine(c), p = 0.22 + v * 0.55;
    if (c.status === "reserva" || c.status === "fora") p += 0.15;       // banco também chama empréstimo
    if (!chance(p)) return;
    var ids = Object.keys(M.interesse).filter(function (id) {
      return M.interesse[id].n >= 25 && !abertas.some(function (a) { return a.clubId === id; });
    });
    var cl = ids.length ? TM.data.club(pick(ids)) : null;
    if (!cl) {
      var lista = clubesNaFaixa(c, c.overall - 5, c.overall + 9 + Math.round(v * 6))
        .filter(function (x) { return !abertas.some(function (a) { return a.clubId === x.id; }); });
      if (!lista.length) return;
      cl = pick(lista);
    }
    var tipo = (c.status === "reserva" || c.status === "fora") && c.age <= 23 && notaClube(cl.id) < notaClube(c.clubId) && chance(0.6) ? "emprestimo" : "compra";
    var prop = montaProposta(c, cl, tipo);
    M.propostas.unshift(prop);
    M.propostas = M.propostas.slice(0, 12);
    noticias.push({ ic: "mail", t: "Proposta do " + cl.name + (tipo === "emprestimo" ? " (empréstimo)" : "") + "." });
    msg(c, "agente", falaProposta(c, prop));
    TM.notify.push(c, { icon: "📨", title: "Proposta na mesa", text: "O " + cl.name + " quer você" + (tipo === "emprestimo" ? " emprestado" : "") + ". Veja em Seu futuro." });
  }

  /* =============== o que o empresário diz =============== */
  function falaProposta(c, p) {
    var M = m(c), est = M.agente.estilo;
    var melhora = p.salario / Math.max(1, M.contrato.salario);
    var base = "Chegou do " + p.clubName + ": " + TIPO[p.tipo].toLowerCase() + ", " + PAPEL[p.papel].toLowerCase() + ", " + fmtR(p.salario) + " por mês. ";
    if (p.tipo === "emprestimo") return base + "Lá você joga. Às vezes um passo para o lado é o que faz o garoto aparecer.";
    if (p.tipo === "renovacao") return base + (melhora >= 1.3 ? "É um bom aumento. O clube acredita em você." : "Dá para pedir mais. Eles não querem te perder.");
    if (melhora >= 1.6 && p.papel !== "promessa") return base + "É um salto. " + (est === "agressivo" ? "Mesmo assim, eu apertaria um pouco." : "Eu fecharia.");
    if (p.papel === "promessa") return base + "Fila grande lá na sua posição. Cuidado para não sumir no banco.";
    return base + (est === "agressivo" ? "Tem espaço para negociar, quer que eu aperte?" : "Proposta honesta. Pensa com calma.");
  }
  function falaAbertura(c) {
    var v = vitrine(c);
    if (c.status === "reserva" || c.status === "fora") return "A janela abriu. Do jeito que está, você não joga. Se aparecer empréstimo, vale ouvir.";
    if (v >= 0.6) return "A janela abriu e o telefone não para. Tem clube grande perguntando por você.";
    return "A janela abriu. Vou sondando o mercado; continua jogando bem que a proposta vem.";
  }
  function conselho(c) {
    var M = m(c), v = vitrine(c), top = topInteresse(c)[0];
    if (M.livre) return "Você está sem clube. Escolhe uma das propostas para seguir jogando.";
    if (top && top.n >= 50) return "O " + top.nome + " está muito interessado. Na próxima janela, deve vir proposta.";
    if (c.status === "reserva" || c.status === "fora") return "Banco não vende jogador. Treina forte e cumpre o que o técnico pede.";
    if (v >= 0.55) return "Sua média chamou atenção. Mantém o nível que eu cuido do resto.";
    return pick(["Foco no próximo jogo. O mercado olha a sequência, não um jogo só.", "Gol e nota alta: é isso que faz o telefone tocar.", "Cuida do corpo. Lesão na janela derruba qualquer negociação."]);
  }
  function topInteresse(c) {
    var M = m(c);
    return Object.keys(M.interesse).map(function (id) { var cl = TM.data.club(id); return cl ? { id: id, nome: cl.name, n: M.interesse[id].n, club: cl } : null; })
      .filter(Boolean).sort(function (a, b) { return b.n - a.n; });
  }

  /* =============== depois de cada jogo =============== */
  function aposRodada(c, out) {
    var M = m(c), noticias = [];
    var jogou = out && out.esc && (out.esc.joga === "titular" || out.esc.joga === "entra");
    c.dinheiro = (c.dinheiro || 0) + Math.round(M.contrato.salario / 4);      // salário da semana
    if (jogou) { M.clube.jogos++; M.clube.gols += out.gols || 0; M.clube.assist += out.assist || 0; }
    Object.keys(M.interesse).forEach(function (id) { M.interesse[id].n -= 2; if (M.interesse[id].n <= 0) delete M.interesse[id]; });
    // olheiros: boa atuação chama atenção
    if (jogou && (out.nota >= 7.2 || out.gols >= 1)) {
      var lista = clubesNaFaixa(c, c.overall - 4, c.overall + 14);
      for (var i = 0; i < (out.nota >= 8 ? 2 : 1) && lista.length; i++) {
        var cl = lista.splice(rnd(lista.length), 1)[0];
        var it = M.interesse[cl.id] || (M.interesse[cl.id] = { n: 0 });
        it.n = clamp(it.n + 12 + rnd(14) + Math.round(vitrine(c) * 10), 0, 100);
        noticias.push({ ic: "telescope", t: it.n >= 60 ? "O " + cl.name + " já fala com o seu empresário." : it.n >= 30 ? "O " + cl.name + " mandou olheiro de novo para te ver." : "Olheiros do " + cl.name + " estavam no estádio." });
        if (it.n >= 30 && chance(0.5)) manchete(c, pick(["Bastidores: ", "Mercado: ", "Exclusivo: "]) + cl.name + " monitora " + c.name + ", do " + c.clubName + ".");
      }
    }
    // a janela abre e fecha
    var jan = janelaDe(c), antes = M.janelaAberta;
    M.janelaAberta = jan.aberta;
    if (jan.aberta && !antes) { noticias.push({ ic: "bell", t: "A janela de transferências abriu." }); msg(c, "agente", falaAbertura(c)); }
    if (!jan.aberta && antes) {
      var perdidas = 0;
      M.propostas.forEach(function (p) { if (p.status === "nova" || p.status === "negociando") { p.status = "expirou"; perdidas++; } });
      noticias.push({ ic: "lock", t: "A janela fechou." + (perdidas ? " " + perdidas + " proposta(s) expiraram." : "") });
      M.pedidoSaida = false;
    }
    if (jan.aberta) novasPropostas(c, noticias);
    // último ano de contrato: o clube decide se renova (na janela do meio)
    if (jan.aberta && jan.nome.indexOf("meio") >= 0 && M.contrato.ate <= c.seasonYear && !M.emprestimo && !M.renovacaoVista) {
      M.renovacaoVista = true;
      var quer = c.status !== "reserva" && c.status !== "fora" || (c.age <= 21 && (c.potential || 0) >= c.overall + 8);
      if (quer) {
        var ren = montaProposta(c, TM.data.club(c.clubId), "renovacao");
        M.propostas.unshift(ren);
        noticias.push({ ic: "file-text", t: "O " + c.clubName + " quer renovar o seu contrato." });
        msg(c, "agente", falaProposta(c, ren));
      } else {
        msg(c, "agente", "O " + c.clubName + " não vai renovar. Seu contrato acaba no fim da temporada: vamos achar outro clube.");
      }
    }
    if (rodadaTemp(c) >= tamanhoTemporada(c)) { M.fimPendente = true; noticias.push({ ic: "flag", t: "Fim da temporada." }); }
    if ((c.rodada || 0) % 6 === 3) msg(c, "agente", conselho(c));
    return noticias;
  }

  /* =============== o clube atual libera? =============== */
  function clubeLibera(c, p) {
    if (p.tipo === "livre" || p.tipo === "renovacao") return { ok: true };
    var M = m(c), valor = valorDe(c);
    var chave = c.status === "intocavel" || c.status === "titular";
    var ultimoAno = M.contrato.ate <= c.seasonYear;
    if (M.emprestimo) return { ok: false, motivo: "Você está emprestado pelo " + M.emprestimo.deNome + ". Só dá para sair quando o empréstimo acabar.", semSaida: true };
    if (p.tipo === "emprestimo") return chave ? { ok: false, motivo: "O " + c.clubName + " não empresta quem é titular." } : { ok: true };
    if (M.pedidoSaida || ultimoAno) return { ok: true };
    if (chave && p.taxa < valor * 1.25) return { ok: false, motivo: "O " + c.clubName + " recusou: você é peça importante e " + fmtR(p.taxa) + " é pouco. Eles só aceitam a partir de " + fmtR(valor * 1.25) + "." };
    if (!chave && p.taxa < valor * 0.7) return { ok: false, motivo: "O " + c.clubName + " achou pouco: quer pelo menos " + fmtR(valor * 0.7) + "." };
    return { ok: true };
  }
  function pedirSaida(c) {
    var M = m(c);
    M.pedidoSaida = true;
    R().mexeConf(c, -15, "Pediu para ser negociado");
    R().recalcStatus(c);
    c.fama = clamp((c.fama || 0) + 1, 0, 100);
    manchete(c, c.name + " pede para deixar o " + c.clubName + ". Torcida reage mal.");
    msg(c, "agente", "Feito. Avisei a diretoria que você quer sair. O vestiário não gostou, mas agora eles têm que ouvir as propostas.");
    R().salva(c);
  }

  /* =============== negociação =============== */
  var PEDIDOS = {
    salario: { nome: "Mais salário", desc: "+20% no salário mensal" },
    luvas: { nome: "Luvas maiores", desc: "Dobrar o bônus de assinatura" },
    titular: { nome: "Garantia de titular", desc: "Chegar com a vaga prometida" }
  };
  function negociar(c, p, pedido) {
    var M = m(c), est = M.agente.estilo;
    var base = 0.35 + p.interesse / 160;
    if (est === "agressivo") base += 0.12;
    if (est === "cauteloso") base -= 0.05;
    if (pedido === "titular") base -= (p.naFrente || 0) * 0.12;
    if (p.tipo === "renovacao") base += 0.1;
    p.feito = (p.feito || []).concat([pedido]);
    p.status = "negociando";
    p.paciencia--;
    if (chance(clamp(base, 0.08, 0.9))) {
      if (pedido === "salario") p.salario = mil(p.salario * 1.2);
      if (pedido === "luvas") p.luvas = mil(Math.max(p.luvas, p.salario) * 2);
      if (pedido === "titular") { p.papel = "titular"; p.prometido = true; }
      R().salva(c);
      return { ok: true, fala: "O " + p.clubName + " topou: " + PEDIDOS[pedido].nome.toLowerCase() + "." };
    }
    if (p.paciencia <= 0 || (est === "agressivo" && chance(0.18))) {
      p.status = "retirada";
      manchete(c, p.clubName + " desiste de " + c.name + " depois de pedida alta.");
      R().salva(c);
      return { ok: false, retirou: true, fala: "O " + p.clubName + " se irritou com a pedida e retirou a proposta." };
    }
    R().salva(c);
    return { ok: false, fala: "O " + p.clubName + " não aceitou. A proposta continua de pé, do jeito que estava." };
  }

  /* =============== fechou: renovação ou transferência =============== */
  function renovar(c, p) {
    var M = m(c);
    M.contrato = { ate: c.seasonYear + p.anos, salario: p.salario };
    c.dinheiro = (c.dinheiro || 0) + (p.luvas || 0);
    p.status = "aceita";
    R().mexeConf(c, 4, "Renovou com o " + c.clubName);
    R().recalcStatus(c);
    manchete(c, c.clubName + " renova com " + c.name + " até " + M.contrato.ate + ".");
    msg(c, "agente", "Renovado até " + M.contrato.ate + ", " + fmtR(p.salario) + " por mês. Agora é jogar.");
    R().salva(c);
  }
  // chamado no fim da apresentação: a partir daqui você é jogador do clube novo
  function transferir(c, p, extra) {
    var M = m(c), cl = TM.data.club(p.clubId), deNome = c.clubName;
    extra = extra || {};
    M.historico.unshift({ clubId: c.clubId, clubName: c.clubName, de: M.clube.desde, ate: c.seasonYear,
      jogos: M.clube.jogos, gols: M.clube.gols, assist: M.clube.assist,
      saida: p.tipo, taxa: p.taxa || 0, para: cl.name, emprestado: !!M.emprestimo });
    if (p.tipo === "emprestimo") M.emprestimo = { de: c.clubId, deNome: c.clubName, ate: c.seasonYear, contrato: M.contrato };
    else { M.emprestimo = null; M.contrato = { ate: c.seasonYear + p.anos, salario: p.salario }; }
    if (p.tipo === "emprestimo") M.contrato = { ate: M.emprestimo.contrato.ate, salario: p.salario };
    c.clubId = cl.id; c.clubName = cl.name; c.leagueId = cl.leagueId;
    c.dinheiro = (c.dinheiro || 0) + (p.luvas || 0);
    c.numero = extra.numero || c.numero;
    M.clube = { jogos: 0, gols: 0, assist: 0, desde: c.seasonYear };
    M.interesse = {}; M.propostas = []; M.pedidoSaida = false; M.livre = false; M.renovacaoVista = false;
    // clube novo, técnico novo, barra nova: quem chega com a vaga prometida começa com ela
    c.tecnico = null; c.rivalId = null;
    R().tecnico(c);
    var base = p.papel === "titular" ? (p.prometido ? 66 : 56) : p.papel === "rodizio" ? 44 : 30;
    c.conf = Math.round(clamp(base + (extra.conf || 0), 10, 82));
    c.confLog = [{ d: 0, por: "Chegada ao " + cl.name + " — a barra recomeça", r: c.rodada || 0 }];
    R().recalcStatus(c);
    c.fama = clamp((c.fama || 0) + (p.taxa >= 5e6 ? 6 : 3) + (extra.fama || 0), 0, 100);
    manchete(c, cl.name + " apresenta " + c.name + (p.tipo === "emprestimo" ? ", emprestado pelo " : ", ex-") + deNome + ".");
    msg(c, "agente", "Fechado! Agora é com você no " + cl.name + ". " + (p.papel === "titular" ? "Você chega com moral: a vaga é sua para perder." : p.papel === "rodizio" ? "Vai brigar por espaço desde o primeiro treino." : "Tem fila na sua frente — é no treino que você passa."));
    TM.notify.push(c, { icon: "✍️", title: "Novo clube", text: "Você é jogador do " + cl.name + ". " + R().tecnico(c).nome + " é o técnico." });
    if (R().comecaSemana) R().comecaSemana(c);
    R().salva(c);
  }

  /* =============== fim da temporada =============== */
  function resumoTemporada(c) {
    var n = (c.ratings || []);
    return { ano: c.seasonYear, clube: c.clubName, jogos: c.seasonApps || 0, gols: c.seasonGoals || 0, assist: c.seasonAssists || 0,
      media: n.length ? +(n.reduce(function (a, b) { return a + b; }, 0) / n.length).toFixed(1) : 0, status: c.status, overall: c.overall };
  }
  function fimTemporada(c) {
    var M = m(c), res = resumoTemporada(c), ano = c.seasonYear;
    M.temporadas = ([res]).concat(M.temporadas || []).slice(0, 30);
    c.age++; c.seasonYear++; c.season = (c.season || 1) + 1;
    c.seasonApps = 0; c.seasonGoals = 0; c.seasonAssists = 0; c.ratings = (c.ratings || []).slice(0, 3);
    M.inicio = c.rodada || 0; M.fimPendente = false; M.pedidoSaida = false; M.renovacaoVista = false;
    M.propostas = (M.propostas || []).filter(function (p) { return p.status === "nova" || p.status === "negociando"; });
    var aviso = "";
    var contratoAcabou = (M.emprestimo ? M.emprestimo.contrato.ate : M.contrato.ate) <= ano;
    if (M.emprestimo && M.emprestimo.ate <= ano && !contratoAcabou) {
      // volta do empréstimo: o clube dono vê os números e decide como te recebe
      var dono = TM.data.club(M.emprestimo.de), foi = M.clube;
      M.historico.unshift({ clubId: c.clubId, clubName: c.clubName, de: M.clube.desde, ate: ano, jogos: foi.jogos, gols: foi.gols, assist: foi.assist, saida: "volta", taxa: 0, para: dono.name, emprestado: true });
      M.contrato = M.emprestimo.contrato; M.emprestimo = null;
      c.clubId = dono.id; c.clubName = dono.name; c.leagueId = dono.leagueId;
      M.clube = { jogos: 0, gols: 0, assist: 0, desde: c.seasonYear };
      c.tecnico = null; c.rivalId = null; R().tecnico(c);
      c.conf = Math.round(clamp(26 + foi.jogos * 0.8 + res.media * 2, 15, 70));
      c.confLog = [{ d: 0, por: "Volta do empréstimo — " + foi.jogos + " jogos lá fora", r: c.rodada || 0 }];
      R().recalcStatus(c);
      aviso = "O empréstimo acabou: você volta para o " + dono.name + ".";
      msg(c, "agente", aviso + " Os " + foi.jogos + " jogos lá fora contam: a barra recomeça mais alta.");
    } else if (contratoAcabou) {
      // contrato acabou (no clube ou no fim do empréstimo): livre, com propostas sem taxa
      M.livre = true;
      M.historico.unshift({ clubId: c.clubId, clubName: c.clubName, de: M.clube.desde, ate: ano, jogos: M.clube.jogos, gols: M.clube.gols, assist: M.clube.assist, saida: "livre", taxa: 0, para: "", emprestado: !!M.emprestimo });
      if (M.emprestimo) { M.contrato = M.emprestimo.contrato; M.emprestimo = null; }
      var lista = clubesNaFaixa(c, c.overall - 8, c.overall + 6), feitas = 0;
      while (feitas < 3 && lista.length) { var cl = lista.splice(rnd(lista.length), 1)[0]; M.propostas.unshift(montaProposta(c, cl, "livre")); feitas++; }
      aviso = "Seu contrato com o " + c.clubName + " acabou. Você está livre: escolha o próximo clube.";
      msg(c, "agente", aviso + " Sem taxa de transferência, tem clube querendo.");
    }
    M.janelaAberta = true;
    msg(c, "agente", "Temporada " + c.seasonYear + " começando. A janela está aberta por 4 rodadas.");
    if (R().comecaSemana) R().comecaSemana(c);
    R().salva(c);
    return { resumo: res, aviso: aviso };
  }
  function travado(c) { var M = m(c); return !!(M.livre || M.fimPendente); }

  /* =============== telas =============== */
  function chipJanela(c) {
    var j = janelaDe(c);
    return el("span", { class: "rm-jan" + (j.aberta ? " on" : "") }, [
      ic(j.aberta ? "door-open" : "lock"),
      j.aberta ? "Janela aberta · fecha em " + j.fecha + " rodada" + (j.fecha > 1 ? "s" : "") : "Janela abre em " + j.abre + " rodada" + (j.abre > 1 ? "s" : "")
    ]);
  }
  function escudos(lista) {
    return el("span", { class: "rm-escudos" }, lista.slice(0, 3).map(function (p) { var cl = TM.data.club(p.clubId); return cl ? TM.img.clubImg(cl, "rm-escudo-mini") : null; }));
  }
  // cartão no centro da carreira
  function cartaoHub(c) {
    var M = m(c), abertas = ativas(c), ult = (M.msgs || [])[0];
    var titulo = M.livre ? "Sem clube — escolha o próximo" : M.fimPendente ? "Fim da temporada" : "Seu futuro";
    return el("button", { class: "rm-hub" + (janelaDe(c).aberta ? " aberta" : "") + (M.livre ? " livre" : ""), on: { click: function () { TM.ui.go(M.fimPendente ? "rae-temporada" : "rae-mercado"); } } }, [
      el("div", { class: "rm-hub-top" }, [ el("span", { class: "rm-hub-t" }, [ ic("briefcase-business"), titulo ]), chipJanela(c) ]),
      abertas.length ? el("div", { class: "rm-hub-props" }, [ escudos(abertas), el("span", { text: abertas.length + (abertas.length > 1 ? " propostas na mesa" : " proposta na mesa") }) ]) : null,
      ult ? el("div", { class: "rm-hub-msg" }, [ el("span", { class: "rm-av", text: iniciais(M.agente.nome) }), el("span", { class: "rm-hub-msg-t", text: ult.t }) ]) : null,
      el("div", { class: "rm-hub-base", text: "Valor " + fmtR(valorDe(c)) + " · contrato até " + M.contrato.ate + " · " + fmtR(M.contrato.salario) + "/mês" + (M.emprestimo ? " · emprestado" : "") })
    ]);
  }
  function linhaNoticia(n) { return el("div", { class: "rm-not" }, [ el("span", { class: "rm-not-ic" }, [ ic(n.ic || "info") ]), el("span", { text: n.t }) ]); }

  // ---------- Seu futuro ----------
  TM.ui.register("rae-mercado", function (screen) {
    var c = R().carreira(); if (!c) { TM.ui.go("rae"); return; }
    var M = m(c);
    (M.msgs || []).forEach(function (x) { x.nova = false; });
    R().salva(c);
    screen.appendChild(TM.ui.topbar("Seu futuro", function () { TM.ui.go("rae-hub"); }));
    var body = el("div", { class: "rae-body" });
    screen.appendChild(body);
    var j = janelaDe(c);

    body.appendChild(el("div", { class: "rm-janela" + (j.aberta ? " on" : "") }, [
      el("div", { class: "rm-janela-ic" }, [ ic(j.aberta ? "door-open" : "lock") ]),
      el("div", {}, [
        el("div", { class: "rm-janela-t", text: j.aberta ? "Janela aberta" : "Janela fechada" }),
        el("div", { class: "rm-janela-s", text: j.aberta ? j.nome + " · fecha em " + j.fecha + " rodada(s)" : j.nome + " abre em " + j.abre + " rodada(s)" })
      ])
    ]));
    if (M.livre) body.appendChild(el("div", { class: "rae-warn big", text: "Seu contrato acabou. Escolha uma das propostas para seguir a carreira." }));
    if (M.emprestimo) body.appendChild(el("div", { class: "rm-info", text: "Emprestado pelo " + M.emprestimo.deNome + " até o fim de " + M.emprestimo.ate + ". Depois você volta para lá." }));

    // propostas
    var lista = (M.propostas || []).slice(0, 8);
    body.appendChild(el("div", { class: "rm-h", text: "Propostas" }));
    if (!lista.length) body.appendChild(el("div", { class: "rm-vazio", text: j.aberta ? "Nenhuma proposta ainda. Jogue bem: olheiro vê tudo." : "Fora da janela, as propostas não chegam. Os clubes estão de olho." }));
    lista.forEach(function (p) {
      var cl = TM.data.club(p.clubId), ok = p.status === "nova" || p.status === "negociando";
      body.appendChild(el("button", { class: "rm-prop" + (ok ? "" : " off"), on: { click: function () { if (ok) TM.ui.go("rae-proposta", { id: p.id }); } } }, [
        cl ? TM.img.clubImg(cl, "rm-prop-escudo") : null,
        el("div", { class: "rm-prop-i" }, [
          el("div", { class: "rm-prop-n", text: p.clubName }),
          el("div", { class: "rm-prop-tags" }, [
            el("span", { class: "rm-tag t-" + p.tipo, text: TIPO[p.tipo] }),
            el("span", { class: "rm-tag p-" + p.papel, text: PAPEL[p.papel] }),
            ok ? null : el("span", { class: "rm-tag off", text: p.status === "retirada" ? "Retirada" : p.status === "aceita" ? "Aceita" : p.status === "recusada" ? "Recusada" : "Expirou" })
          ]),
          el("div", { class: "rm-prop-s", text: fmtR(p.salario) + "/mês · " + p.anos + (p.anos > 1 ? " anos" : " ano") + (p.taxa ? " · taxa " + fmtR(p.taxa) : "") })
        ]),
        ok ? el("span", { class: "rm-seta" }, [ ic("chevron-right") ]) : null
      ]));
    });

    // o empresário
    var est = ESTILOS[M.agente.estilo] || ESTILOS.cauteloso;
    var chat = el("div", { class: "rm-chat" }, (M.msgs || []).slice(0, 5).map(function (x) {
      return el("div", { class: "rm-bal" + (x.de === "agente" ? "" : " outro") }, [ el("div", { class: "rm-bal-t", text: x.t }) ]);
    }));
    body.appendChild(el("div", { class: "rm-agente" }, [
      el("div", { class: "rm-agente-top" }, [
        el("span", { class: "rm-av grande", text: iniciais(M.agente.nome) }),
        el("div", {}, [ el("div", { class: "rm-agente-n", text: M.agente.nome }), el("div", { class: "rm-agente-e", text: "Empresário · " + est.nome + " — " + est.desc }) ])
      ]),
      chat,
      (!M.pedidoSaida && !M.livre && !M.emprestimo && j.aberta) ? TM.ui.button("Pedir para ser negociado", function () {
        TM.ui.confirm("Pedir para sair?", "O clube passa a aceitar propostas, mas o técnico e a torcida não vão gostar: a confiança cai 15 pontos.", "Pedir para sair", function () { pedirSaida(c); TM.ui.toast("Pedido feito: agora o clube ouve propostas.", "alerta"); TM.ui.go("rae-mercado"); }, true);
      }, "btn") : null,
      M.pedidoSaida ? el("div", { class: "rm-info", text: "Você pediu para sair: o " + c.clubName + " está ouvindo propostas." }) : null
    ]));

    // quem está de olho
    var olho = topInteresse(c).slice(0, 5);
    if (olho.length) {
      body.appendChild(el("div", { class: "rm-h", text: "Quem está de olho" }));
      body.appendChild(el("div", { class: "rm-olho" }, olho.map(function (o) {
        return el("div", { class: "rm-olho-l" }, [
          TM.img.clubImg(o.club, "rm-escudo-mini"), el("span", { class: "rm-olho-n", text: o.nome }),
          el("span", { class: "rm-olho-bar" }, [ el("i", { style: "width:" + o.n + "%" }) ]),
          el("span", { class: "rm-olho-v", text: o.n >= 60 ? "Muito" : o.n >= 30 ? "Interessado" : "Observando" })
        ]);
      })));
    }
    // imprensa
    if ((M.manchetes || []).length) {
      body.appendChild(el("div", { class: "rm-h", text: "Na imprensa" }));
      body.appendChild(el("div", { class: "rm-jornal" }, M.manchetes.slice(0, 4).map(function (n) { return el("div", { class: "rm-manchete", text: n.t }); })));
    }
    // contrato e valor
    body.appendChild(el("div", { class: "rm-contrato" }, [
      el("div", {}, [ el("b", { text: fmtR(valorDe(c)) }), el("span", { text: "Valor de mercado" }) ]),
      el("div", {}, [ el("b", { text: fmtR(M.contrato.salario) }), el("span", { text: "Salário por mês" }) ]),
      el("div", {}, [ el("b", { text: String(M.contrato.ate) }), el("span", { text: "Contrato até" }) ]),
      el("div", {}, [ el("b", { text: fmtR(c.dinheiro || 0) }), el("span", { text: "Na conta" }) ])
    ]));
    body.appendChild(TM.ui.button("Minha trajetória", function () { TM.ui.go("rae-trajetoria"); }, "btn"));
  });

  // ---------- a proposta ----------
  TM.ui.register("rae-proposta", function (screen, params) {
    var c = R().carreira(); if (!c) { TM.ui.go("rae"); return; }
    var M = m(c), p = (M.propostas || []).filter(function (x) { return x.id === (params && params.id); })[0];
    if (!p || (p.status !== "nova" && p.status !== "negociando")) { TM.ui.go("rae-mercado"); return; }
    var cl = TM.data.club(p.clubId), pp = papelNoClube(c, p.clubId);
    screen.appendChild(TM.ui.topbar(TIPO[p.tipo], function () { TM.ui.go("rae-mercado"); }));
    var body = el("div", { class: "rae-body" });
    screen.appendChild(body);

    body.appendChild(el("div", { class: "rm-cartaz" }, [
      TM.img.stadiumImg(cl, "rm-cartaz-foto"), el("span", { class: "rm-cartaz-tinta" }), el("span", { class: "rm-cartaz-veu" }), el("span", { class: "rm-faixas" }),
      el("div", { class: "rm-cartaz-in" }, [
        TM.img.clubImg(cl, "rm-cartaz-escudo"),
        el("div", { class: "rm-cartaz-sobre", text: p.tipo === "renovacao" ? "O seu clube" : "Proposta" }),
        el("div", { class: "rm-cartaz-n", text: p.clubName }),
        el("div", { class: "rm-cartaz-s", text: p.tipo === "renovacao" ? "quer renovar com você" : "quer " + c.name + (p.tipo === "emprestimo" ? " emprestado" : "") })
      ])
    ]));

    function linha(l, v, extra) { return el("div", { class: "rm-termo" }, [ el("span", { text: l }), el("b", { text: v }), extra ? el("i", { text: extra }) : null ]); }
    var melhora = Math.round((p.salario / Math.max(1, M.contrato.salario) - 1) * 100);
    body.appendChild(el("div", { class: "rm-termos" }, [
      linha("Papel", PAPEL[p.papel] + (p.prometido ? " (prometido)" : ""), p.tipo === "renovacao" ? null : (pp.naFrente ? pp.naFrente + " na sua frente na posição" : "ninguém na sua frente")),
      linha("Salário", fmtR(p.salario) + "/mês", (melhora >= 0 ? "+" : "") + melhora + "% sobre o atual"),
      linha("Contrato", p.tipo === "emprestimo" ? "1 temporada" : p.anos + " anos", p.tipo === "emprestimo" ? "volta para o " + c.clubName + " depois" : "até " + (c.seasonYear + p.anos)),
      p.taxa ? linha("Taxa ao " + c.clubName, fmtR(p.taxa), "seu valor: " + fmtR(valorDe(c))) : null,
      p.luvas ? linha("Luvas", fmtR(p.luvas), "bônus na assinatura") : null
    ]));
    if (pp.dono && p.tipo !== "renovacao") {
      body.appendChild(el("div", { class: "rm-dono" }, [
        el("div", { class: "rm-h", text: "Quem é o dono da vaga lá" }),
        el("div", { class: "rm-dono-b" }, [ TM.img.playerImg(pp.dono, "rm-dono-foto"),
          el("div", {}, [ el("div", { class: "rm-dono-n", text: pp.dono.name }), el("div", { class: "rm-dono-s", text: pp.dono.age + " anos · overall " + pp.dono.overall + " · você tem " + c.overall }) ]) ])
      ]));
    }
    body.appendChild(el("div", { class: "rm-conselho" }, [ el("span", { class: "rm-av", text: iniciais(M.agente.nome) }), el("span", { text: falaProposta(c, p) }) ]));

    var restam = Object.keys(PEDIDOS).filter(function (k) { return (p.feito || []).indexOf(k) < 0 && !(k === "titular" && p.papel === "titular") && !(k === "luvas" && p.tipo === "emprestimo"); });
    var acoes = el("div", { class: "rm-acoes" });
    acoes.appendChild(TM.ui.button(p.tipo === "renovacao" ? "Renovar" : "Aceitar", function () {
      if (p.tipo === "renovacao") { renovar(c, p); TM.ui.toast("Contrato renovado até " + m(c).contrato.ate + ".", "ok"); TM.ui.go("rae-mercado"); return; }
      var lib = clubeLibera(c, p);
      if (lib.ok) { TM.ui.go("rae-apresentacao", { id: p.id }); return; }
      if (lib.semSaida) { TM.ui.toast(lib.motivo, "erro"); return; }
      TM.ui.confirm("O " + c.clubName + " não liberou", lib.motivo + " Pedir para sair destrava a negociação, mas a confiança do técnico cai 15.", "Pedir para sair", function () {
        pedirSaida(c); TM.ui.toast("Pedido feito. O clube aceitou negociar.", "alerta"); TM.ui.go("rae-apresentacao", { id: p.id });
      }, true);
    }, "btn primary"));
    if (restam.length && p.paciencia > 0) {
      acoes.appendChild(TM.ui.button("Negociar", function () {
        TM.ui.optionsMenu("O que pedir ao " + p.clubName + "?", restam.map(function (k) {
          return { label: PEDIDOS[k].nome + " — " + PEDIDOS[k].desc, fn: function () {
            var r = negociar(c, p, k);
            TM.ui.toast(r.fala, r.ok ? "ok" : r.retirou ? "erro" : "alerta");
            TM.ui.go(r.retirou ? "rae-mercado" : "rae-proposta", { id: p.id });
          } };
        }));
      }, "btn"));
    }
    acoes.appendChild(TM.ui.button("Recusar", function () {
      p.status = "recusada"; R().salva(c);
      if (p.tipo === "renovacao") msg(c, "agente", "Recusamos a renovação. Se ninguém aparecer até o fim da temporada, você sai de graça.");
      TM.ui.toast("Proposta recusada.");
      TM.ui.go("rae-mercado");
    }, "btn ghost"));
    body.appendChild(acoes);
  });

  // ---------- a apresentação (exames → assinatura → camisa → coletiva → boas-vindas) ----------
  var NUM_POS = { FW: [9, 11, 7, 19, 29, 99, 17, 21], MF: [8, 10, 5, 20, 18, 16, 15, 28], DF: [3, 4, 2, 6, 13, 14, 25, 33], GK: [1, 12, 23, 31, 40] };
  var RESPOSTAS = [
    { t: "Vim para ganhar títulos e brigar por tudo.", conf: 2, fama: 2, efeito: "A torcida adorou a ambição." },
    { t: "Vou trabalhar e ganhar minha vaga no treino.", conf: 6, fama: 0, efeito: "O técnico gostou da humildade." },
    { t: "Foi a melhor proposta para a minha carreira.", conf: -2, fama: 1, efeito: "A sinceridade pegou mal com parte da torcida." }
  ];
  function postsTorcida(c, p, cl) {
    var nomes = ["dalua", "raiz", "dearquibancada", "sempre", "dacurva", "fiel", "doestadio", "news"];
    var slug = cl.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 10);
    var bons = ["Chegou o reforço! Bem-vindo, " + c.name + "!", "Esse moleque joga muito, vi os jogos dele.", "Diretoria acertou em cheio dessa vez.", "Camisa " + (c.numero || "") + " tem dono novo. Bora!"];
    var desc = ["Mais um para o banco?", "Quero ver jogar antes de comemorar.", p.taxa >= 5e6 ? "Pagaram " + fmtR(p.taxa) + "... tomara que valha." : "Contratação de baixo custo, sem expectativa."];
    var lista = p.papel === "promessa" || p.tipo === "emprestimo" ? [pick(bons), pick(desc), pick(desc)] : [pick(bons), pick(bons), pick(desc)];
    return lista.filter(function (t, i, a) { return a.indexOf(t) === i; }).map(function (t) { return { u: "@" + slug + "_" + pick(nomes), t: t }; });
  }
  function camisaSvg(cl, numero) {
    var c1 = (cl.colors && cl.colors.primary) || "#0f7a3a", c2 = (cl.colors && cl.colors.secondary) || "#ffffff";
    var NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 120 120"); svg.setAttribute("class", "rm-camisa");
    svg.innerHTML = '<path d="M38 8 L22 14 L4 34 L18 50 L28 42 L28 112 L92 112 L92 42 L102 50 L116 34 L98 14 L82 8 Q60 24 38 8Z" fill="' + c1 + '" stroke="rgba(0,0,0,.35)" stroke-width="2"/>' +
      '<path d="M38 8 Q60 24 82 8" fill="none" stroke="' + c2 + '" stroke-width="5"/>' +
      '<text x="60" y="88" text-anchor="middle" font-family="TM Cond, Inter, sans-serif" font-weight="800" font-size="46" fill="' + c2 + '" stroke="rgba(0,0,0,.35)" stroke-width="1.5">' + numero + '</text>';
    return svg;
  }
  TM.ui.register("rae-apresentacao", function (screen, params) {
    var c = R().carreira(); if (!c) { TM.ui.go("rae"); return; }
    var M = m(c), p = (M.propostas || []).filter(function (x) { return x.id === (params && params.id); })[0];
    if (!p) { TM.ui.go("rae-mercado"); return; }
    var cl = TM.data.club(p.clubId);
    var st = { passo: 0, numero: null, resp: null };
    screen.classList.add("rm-apres-tela");
    var topo = TM.ui.topbar("Fechado com o " + cl.name, null);
    screen.appendChild(topo);
    var body = el("div", { class: "rae-body" });
    screen.appendChild(body);
    var PASSOS = ["Exames", "Assinatura", "Camisa", "Coletiva", "Apresentação"];

    function trilha() {
      return el("div", { class: "rm-passos" }, PASSOS.map(function (n, i) { return el("span", { class: "rm-passo" + (i < st.passo ? " feito" : i === st.passo ? " agora" : ""), text: n }); }));
    }
    function desenha() {
      TM.ui.clear(body);
      body.appendChild(trilha());
      if (st.passo === 0) {
        var barra = el("i", {});
        var txt = el("div", { class: "rm-exame-t", text: "Exames médicos no " + cl.name + "…" });
        body.appendChild(el("div", { class: "rm-exame" }, [ el("div", { class: "rm-exame-ic" }, [ ic("stethoscope") ]), txt, el("div", { class: "rm-exame-bar" }, [ barra ]) ]));
        requestAnimationFrame(function () { barra.style.width = "100%"; });
        setTimeout(function () {
          txt.textContent = c.lesao > 0 ? "Os exames acharam a lesão, mas o clube manteve o negócio." : "Aprovado nos exames. Tudo certo com o corpo.";
          body.appendChild(TM.ui.button("Ir para a assinatura", function () { st.passo = 1; desenha(); }, "btn primary"));
        }, 1700);
      } else if (st.passo === 1) {
        body.appendChild(el("div", { class: "rm-contrato-doc" }, [
          el("div", { class: "rm-doc-top" }, [ TM.img.clubImg(cl, "rm-doc-escudo"), el("div", {}, [ el("div", { class: "rm-doc-t", text: "Contrato de " + (p.tipo === "emprestimo" ? "empréstimo" : "trabalho") }), el("div", { class: "rm-doc-s", text: cl.name + " · temporada " + c.seasonYear }) ]) ]),
          el("div", { class: "rm-doc-l" }, [ el("span", { text: "Atleta" }), el("b", { text: c.name }) ]),
          el("div", { class: "rm-doc-l" }, [ el("span", { text: "Salário mensal" }), el("b", { text: fmtR(p.salario) }) ]),
          el("div", { class: "rm-doc-l" }, [ el("span", { text: "Vigência" }), el("b", { text: p.tipo === "emprestimo" ? "até o fim de " + c.seasonYear : "até " + (c.seasonYear + p.anos) }) ]),
          p.luvas ? el("div", { class: "rm-doc-l" }, [ el("span", { text: "Luvas" }), el("b", { text: fmtR(p.luvas) }) ]) : null,
          p.taxa ? el("div", { class: "rm-doc-l" }, [ el("span", { text: "Taxa paga ao " + c.clubName }), el("b", { text: fmtR(p.taxa) }) ]) : null,
          el("div", { class: "rm-assina" }, [ el("span", { class: "rm-assina-nome", text: c.name }), el("span", { class: "rm-assina-l", text: "assinatura do atleta" }) ])
        ]));
        body.appendChild(TM.ui.button("Assinar", function () { st.passo = 2; desenha(); }, "btn primary"));
      } else if (st.passo === 2) {
        var usados = {}; (TM.data.clubPlayers(cl.id) || []).forEach(function (x) { if (x.number) usados[x.number] = 1; });
        var ops = (NUM_POS[c.pos] || NUM_POS.MF).filter(function (n) { return !usados[n]; });
        for (var n = 2; ops.length < 12 && n < 100; n++) if (!usados[n] && ops.indexOf(n) < 0) ops.push(n);
        st.numero = st.numero || ops[0];
        var vitr = el("div", { class: "rm-camisa-wrap" }, [ camisaSvg(cl, st.numero) ]);
        body.appendChild(el("div", { class: "rm-h", text: "Escolha o seu número" }));
        body.appendChild(vitr);
        body.appendChild(el("div", { class: "rm-nums" }, ops.map(function (num) {
          return el("button", { class: "rm-num" + (num === st.numero ? " on" : ""), text: num, on: { click: function () { st.numero = num; desenha(); } } });
        })));
        body.appendChild(TM.ui.button("Vestir a " + st.numero, function () { st.passo = 3; desenha(); }, "btn primary"));
      } else if (st.passo === 3) {
        var pergunta = p.tipo === "emprestimo" ? "O que você espera desse empréstimo?" : p.tipo === "livre" ? "Por que escolheu o " + cl.name + " entre as propostas?" : "Por que você escolheu o " + cl.name + "?";
        body.appendChild(el("div", { class: "rm-coletiva" }, [ el("div", { class: "rm-coletiva-ic" }, [ ic("mic") ]), el("div", { class: "rm-coletiva-p", text: "“" + pergunta + "”" }), el("div", { class: "rm-coletiva-q", text: "— repórter, na sala de imprensa" }) ]));
        RESPOSTAS.forEach(function (r) {
          body.appendChild(el("button", { class: "rm-resp", text: r.t, on: { click: function () { st.resp = r; st.passo = 4; desenha(); } } }));
        });
      } else {
        // a apresentação: daqui em diante você é do clube novo
        if (!st.feito) { st.feito = true; transferir(c, p, { numero: st.numero, conf: st.resp.conf, fama: st.resp.fama }); }
        var posts = postsTorcida(c, p, cl);
        body.appendChild(el("div", { class: "rm-apres" }, [
          TM.img.stadiumImg(cl, "rm-cartaz-foto"), el("span", { class: "rm-cartaz-tinta" }), el("span", { class: "rm-cartaz-veu" }), el("span", { class: "rm-faixas" }),
          el("div", { class: "rm-apres-in" }, [
            TM.img.clubImg(cl, "rm-apres-escudo"),
            el("div", { class: "rm-apres-sobre", text: "Bem-vindo" }),
            el("div", { class: "rm-apres-n", text: c.name }),
            camisaSvg(cl, st.numero),
            el("div", { class: "rm-apres-s", text: (p.tipo === "emprestimo" ? "Emprestado até o fim de " + c.seasonYear : "Contrato até " + m(c).contrato.ate) + " · " + (TM.data.stadium(cl).name || "") })
          ])
        ]));
        body.appendChild(el("div", { class: "rm-info", text: st.resp.efeito }));
        body.appendChild(el("div", { class: "rm-h", text: "A torcida nas redes" }));
        body.appendChild(el("div", { class: "rm-posts" }, posts.map(function (x) {
          return el("div", { class: "rm-post" }, [ el("span", { class: "rm-av", text: x.u.slice(1, 3).toUpperCase() }), el("div", {}, [ el("div", { class: "rm-post-u", text: x.u }), el("div", { class: "rm-post-t", text: x.t }) ]) ]);
        })));
        body.appendChild(TM.ui.button("Começar no " + cl.name, function () { TM.ui.go("rae-hub"); }, "btn primary"));
      }
    }
    desenha();
  });

  // ---------- a trajetória ----------
  TM.ui.register("rae-trajetoria", function (screen) {
    var c = R().carreira(); if (!c) { TM.ui.go("rae"); return; }
    var M = m(c);
    screen.appendChild(TM.ui.topbar("Minha trajetória", function () { TM.ui.go("rae-mercado"); }));
    var body = el("div", { class: "rae-body" });
    screen.appendChild(body);
    var agora = TM.data.club(c.clubId);
    function item(clubId, nome, periodo, numeros, saida, atual) {
      var cl = TM.data.club(clubId);
      return el("div", { class: "rm-traj" + (atual ? " atual" : "") }, [
        el("span", { class: "rm-traj-ponto" }),
        cl ? TM.img.clubImg(cl, "rm-traj-escudo") : null,
        el("div", { class: "rm-traj-i" }, [ el("div", { class: "rm-traj-n", text: nome }), el("div", { class: "rm-traj-p", text: periodo + " · " + numeros }), saida ? el("div", { class: "rm-traj-s", text: saida }) : null ])
      ]);
    }
    body.appendChild(item(c.clubId, c.clubName + (M.emprestimo ? " (empréstimo)" : ""), "desde " + M.clube.desde, plural(M.clube.jogos, "jogo", "jogos") + ", " + plural(M.clube.gols, "gol", "gols"), null, true));
    (M.historico || []).forEach(function (h) {
      var saida = h.saida === "compra" ? "Vendido ao " + h.para + " por " + fmtR(h.taxa)
        : h.saida === "emprestimo" ? "Emprestado ao " + h.para
        : h.saida === "volta" ? "Fim do empréstimo — voltou ao " + h.para
        : h.saida === "livre" ? "Saiu ao fim do contrato" + (h.para ? " para o " + h.para : "") : "";
      body.appendChild(item(h.clubId, h.clubName + (h.emprestado ? " (empréstimo)" : ""), h.de === h.ate ? String(h.de) : h.de + "–" + h.ate, plural(h.jogos, "jogo", "jogos") + ", " + plural(h.gols, "gol", "gols") + ", " + plural(h.assist, "assistência", "assistências"), saida, false));
    });
    if ((M.temporadas || []).length) {
      body.appendChild(el("div", { class: "rm-h", text: "Temporadas" }));
      M.temporadas.forEach(function (t) {
        body.appendChild(el("div", { class: "rm-temp" }, [ el("b", { text: String(t.ano) }), el("span", { text: t.clube }), el("span", { text: plural(t.jogos, "jogo", "jogos") + " · " + plural(t.gols, "gol", "gols") + " · " + plural(t.assist, "assist.", "assist.") + " · média " + (t.media ? t.media.toFixed(1) : "—") }) ]));
      });
    }
    if (!agora) body.appendChild(el("div", { class: "rm-vazio", text: "—" }));
  });

  // ---------- fim da temporada ----------
  TM.ui.register("rae-temporada", function (screen) {
    var c = R().carreira(); if (!c) { TM.ui.go("rae"); return; }
    var M = m(c);
    if (!M.fimPendente) { TM.ui.go("rae-hub"); return; }
    var res = resumoTemporada(c);
    screen.appendChild(TM.ui.topbar("Fim da temporada " + res.ano, function () { TM.ui.go("rae-hub"); }));
    var body = el("div", { class: "rae-body" });
    screen.appendChild(body);
    body.appendChild(el("div", { class: "rm-fim" }, [
      el("div", { class: "rm-fim-sobre", text: "Temporada " + res.ano + " · " + res.clube }),
      el("div", { class: "rm-fim-g" }, [
        el("div", {}, [ el("b", { text: res.jogos }), el("span", { text: "Jogos" }) ]),
        el("div", {}, [ el("b", { text: res.gols }), el("span", { text: "Gols" }) ]),
        el("div", {}, [ el("b", { text: res.assist }), el("span", { text: "Assist." }) ]),
        el("div", {}, [ el("b", { text: res.media ? res.media.toFixed(1) : "—" }), el("span", { text: "Média" }) ])
      ]),
      el("div", { class: "rm-fim-s", text: "Status no fim: " + ((R().STATUS[res.status] || {}).nome || res.status) + " · overall " + res.overall + " · " + (c.age + 1) + " anos na próxima" })
    ]));
    var ultimo = M.contrato.ate <= c.seasonYear;
    if (M.emprestimo && M.emprestimo.ate <= c.seasonYear) body.appendChild(el("div", { class: "rm-info", text: "O empréstimo acaba agora: você volta para o " + M.emprestimo.deNome + "." }));
    else if (ultimo) body.appendChild(el("div", { class: "rae-warn big", text: "Seu contrato acaba agora. Você vai ficar livre para escolher o próximo clube." }));
    body.appendChild(TM.ui.button("Começar a temporada " + (c.seasonYear + 1), function () {
      var r = fimTemporada(c);
      if (r.aviso) TM.ui.toast(r.aviso, "alerta");
      TM.ui.go(m(c).livre ? "rae-mercado" : "rae-hub");
    }, "btn primary"));
  });

  TM.raeMercado = {
    m: m, aposRodada: aposRodada, cartaoHub: cartaoHub, linhaNoticia: linhaNoticia, travado: travado,
    janelaDe: janelaDe, valorDe: valorDe, fmtR: fmtR, clubeLibera: clubeLibera, negociar: negociar,
    transferir: transferir, renovar: renovar, fimTemporada: fimTemporada, montaProposta: montaProposta,
    tamanhoTemporada: tamanhoTemporada, rodadaTemp: rodadaTemp, pedirSaida: pedirSaida, vitrine: vitrine
  };
})(window);
