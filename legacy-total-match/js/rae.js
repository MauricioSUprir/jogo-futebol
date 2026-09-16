/* ================= TOTAL MATCH — RUMO AO ESTRELATO =================
   Carreira de jogador reconstruída em cima de três ideias:
   1. a semana é o jogo (energia limitada, cada escolha custa algo);
   2. o técnico tem opinião sua, e ela é uma barra que sobe e desce;
   3. ser titular depende de QUEM está na sua frente, não de um número fixo.
   Módulo novo e isolado: não encosta em js/player.js, então carreiras
   antigas continuam funcionando no modo antigo.                        */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  var ANO = 2026;
  var KEY = "rae";

  function car() { return TM.storage.read(KEY, null); }
  function save(c) { TM.storage.write(KEY, c); }
  function limpa() { TM.storage.remove(KEY); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[rnd(arr.length)]; }

  /* =============== 1. A BARRA DE CONFIANÇA =============== */

  // O limiar para ser titular NÃO é fixo: ele é a distância entre você e o
  // concorrente direto. Brigar por vaga com um 79 sendo 64 exige quase a
  // perfeição; ser 79 num elenco de 64 já entrega a vaga.
  function limiar(c) {
    var r = rival(c);
    var d = (r ? r.overall : c.overall) - c.overall;
    var lim = 50 + d * 2.2;
    var t = tecnico(c);
    // o técnico que prefere rodado cobra mais do garoto; o formador protege
    if (t.tipo === "formaBase" && c.age <= 21) lim += 8;
    if (t.tipo === "pai" && c.age <= 21) lim -= 6;
    return Math.round(clamp(lim, 5, 95));
  }
  // ganhar a vaga é mais difícil do que mantê-la — sem isso o status trocaria
  // toda semana e nada teria peso
  function limiarManter(c) { return limiar(c) - 8; }

  var STATUS = {
    intocavel:   { nome: "Intocável",      ic: "👑", css: "rae-st-top",  desc: "Joga até machucado. O time é seu." },
    titular:     { nome: "Titular",        ic: "✅", css: "rae-st-tit",  desc: "Começa jogando." },
    alternativo: { nome: "Alternativo",    ic: "🔄", css: "rae-st-alt",  desc: "Reveza e entra no segundo tempo." },
    reserva:     { nome: "Reserva",        ic: "🪑", css: "rae-st-res",  desc: "Entra aos 80' — se entrar." },
    fora:        { nome: "Fora dos planos", ic: "🚫", css: "rae-st-out", desc: "Nem relacionado." }
  };

  function recalcStatus(c) {
    var lim = limiar(c);
    var eraTitular = c.status === "titular" || c.status === "intocavel";
    var alvo = eraTitular ? limiarManter(c) : lim;
    var s;
    var eraTop = c.status === "intocavel";
    if (c.conf >= (eraTop ? 84 : 90) && c.conf >= alvo) s = "intocavel";
    else if (c.conf >= alvo) s = "titular";
    else if (c.conf >= lim - 25) s = "alternativo";
    else if (c.conf >= 15) s = "reserva";
    else s = "fora";
    var mudou = s !== c.status;
    c.status = s;
    return mudou;
  }

  // todo movimento da barra passa por aqui, e todo movimento vira uma linha
  // no histórico — o jogador nunca deve se perguntar "por que caí?"
  function mexeConf(c, delta, motivo) {
    if (!delta) return;
    var t = tecnico(c);
    if (t.tipo === "pavioCurto" && delta < 0) delta *= 1.6;
    if (t.tipo === "meritocrata" && /treino/i.test(motivo || "")) delta *= 1.5;
    // ganho decrescente: quanto mais alto, mais caro subir. Sem isso a barra
    // cola em 100 na primeira boa sequência e nunca mais desce.
    if (delta > 0) delta *= (1 - c.conf / 150);
    delta = Math.round(delta);
    if (!delta) return;
    var antes = c.conf;
    c.conf = Math.round(clamp(c.conf + delta, 0, 100));
    if (c.conf === antes) return;
    c.confLog = ([{ d: c.conf - antes, por: motivo || "", r: c.rodada || 0 }]).concat(c.confLog || []).slice(0, 12);
  }

  /* =============== 2. O TÉCNICO =============== */

  var TIPOS_TEC = {
    meritocrata: { nome: "Meritocrata",  desc: "Quem treina melhor, joga. Currículo não conta." },
    formaBase:   { nome: "Conservador",  desc: "Confia no rodado. Garoto precisa provar o dobro." },
    pavioCurto:  { nome: "Pavio curto",  desc: "Um jogo ruim e ele te tira do time." },
    pai:         { nome: "Formador",     desc: "Gosta de lapidar jovem e tem paciência." }
  };
  var NOMES_TEC = ["Ademir Fonseca", "Cláudio Bertoldo", "Ivan Sardinha", "Marcos Vilela", "Renan Piovezan",
                   "Sérgio Bastos", "Tiago Verdi", "Wagner Ottoni", "Eduardo Grasso", "Nelson Aragão"];

  // instruções pessoais: cada uma aponta pra um treino da semana. Cumprir sobe
  // a barra; ignorar a semana inteira derruba.
  var INSTRUCOES = [
    { id: "corpo",   txt: "Quero você mais forte no corpo a corpo. Academia, todo dia que der.",       treino: "academia" },
    { id: "posic",   txt: "Seu posicionamento me preocupa. Quero você no vídeo e no treino tático.",   treino: "tatico" },
    { id: "decidir", txt: "Você chega e não resolve. Quero finalização no treino técnico.",            treino: "tecnico" },
    { id: "fome",    txt: "Quero ver fome. Fica depois do treino, sozinho, que eu reparo.",            treino: "extra" }
  ];

  function tecnico(c) {
    if (!c.tecnico) {
      var tipos = Object.keys(TIPOS_TEC);
      c.tecnico = { nome: pick(NOMES_TEC), tipo: pick(tipos), instrucao: pick(INSTRUCOES).id };
    }
    return c.tecnico;
  }
  function instrucaoDe(c) {
    var id = tecnico(c).instrucao;
    return INSTRUCOES.filter(function (i) { return i.id === id; })[0] || INSTRUCOES[0];
  }
  // técnico novo = barra nova. Quem chegou caro começa com a vaga na mão;
  // quem chegou de graça prova tudo de novo.
  function novoTecnico(c, motivo) {
    var tipos = Object.keys(TIPOS_TEC);
    c.tecnico = { nome: pick(NOMES_TEC), tipo: pick(tipos), instrucao: pick(INSTRUCOES).id };
    var base = clamp(34 + (c.overall - nivelElenco(c)) * 1.8 + (c.fama || 0) * 0.3, 16, 72);
    c.conf = Math.round(base);
    c.confLog = [{ d: 0, por: "Chegada de " + c.tecnico.nome + " — a barra recomeça", r: c.rodada || 0 }];
    recalcStatus(c);
    TM.notify.push(c, { icon: "👔", title: "Técnico novo", text: c.tecnico.nome + " assumiu o " + c.clubName + ". " + (motivo || "Você começa do zero com ele.") });
  }

  /* =============== 3. A HIERARQUIA DA POSIÇÃO =============== */

  // todo mundo do elenco que joga na sua posição, ordenado por overall
  function concorrentes(c) {
    var elenco = TM.data.clubPlayers(c.clubId) || [];
    return elenco.filter(function (p) { return p.pos === c.pos && p.id !== c.id; })
                 .sort(function (a, b) { return b.overall - a.overall; });
  }
  function rival(c) {
    var lista = concorrentes(c);
    if (!lista.length) return null;
    if (c.rivalId) {
      var r = lista.filter(function (p) { return p.id === c.rivalId; })[0];
      if (r) return r;
    }
    // o concorrente é quem está LOGO ACIMA de você na fila, não o craque do
    // elenco: você briga um degrau por vez e, ao passar, encara o próximo.
    var acima = lista.filter(function (p) { return p.overall > c.overall; });
    var r2 = acima.length ? acima[acima.length - 1] : lista[0];
    c.rivalId = r2.id;
    return r2;
  }
  // quando você passa o concorrente atual, o próximo da fila assume o posto
  function atualizaRival(c) {
    var r = rival(c);
    if (r && r.overall < c.overall) {
      var lista = concorrentes(c);
      var acima = lista.filter(function (p) { return p.overall > c.overall; });
      if (acima.length) {
        var novo = acima[acima.length - 1];
        if (novo.id !== c.rivalId) {
          c.rivalId = novo.id;
          TM.notify.push(c, { icon: "🥊", title: "Novo concorrente", text: "Você passou " + r.name + ". Agora a briga é com " + novo.name + " (" + novo.overall + ")." });
          return novo;
        }
      }
    }
    return r;
  }
  // sua posição na fila: quantos estão efetivamente à sua frente
  function lugarNaFila(c) {
    var acima = concorrentes(c).filter(function (p) { return p.overall > c.overall; }).length;
    return acima + 1;
  }

  /* =============== 4. A SEMANA =============== */

  var ATIV = {
    academia: { ic: "🏋️", nome: "Academia",          custo: 22, conf: 1,  attr: ["phy", "pac"], risco: 0.020, desc: "Força e resistência." },
    tecnico:  { ic: "⚽",  nome: "Treino técnico",     custo: 16, conf: 1,  attr: "foco",         risco: 0.010, desc: "Um atributo à sua escolha." },
    tatico:   { ic: "🧠",  nome: "Treino tático",      custo: 12, conf: 3,  attr: ["def", "pas"], risco: 0.005, desc: "O técnico repara em quem entende o esquema." },
    extra:    { ic: "🎯",  nome: "Trabalho extra",     custo: 34, conf: 5,  attr: "foco",         risco: 0.045, desc: "Sozinho, depois do treino. Ganho grande, desgaste grande." },
    fisio:    { ic: "🩺",  nome: "Fisioterapia",       custo: -26, conf: 0, attr: null,           risco: -1,    desc: "Recupera e blinda contra lesão." },
    descanso: { ic: "😴",  nome: "Descanso",           custo: -38, conf: 0, attr: null,           risco: 0,     desc: "Chega inteiro no domingo." },
    midia:    { ic: "📺",  nome: "Mídia / patrocínio", custo: 8,  conf: -2, attr: null,           risco: 0,     desc: "Dinheiro e fama. O técnico não gosta." },
    pessoal:  { ic: "👨‍👩‍👦", nome: "Vida pessoal",   custo: 5,  conf: 0,  attr: null,           risco: 0,     desc: "Família e cabeça no lugar." }
  };
  var ORDEM_ATIV = ["academia", "tecnico", "tatico", "extra", "fisio", "descanso", "midia", "pessoal"];

  // dias até o próximo jogo: meio de semana aperta, semana cheia sobra
  function diasDaSemana(c) { return (c.rodada || 0) % 3 === 2 ? 2 : 5; }

  function comecaSemana(c) {
    c.semana = { dias: diasDaSemana(c), plano: [], notas: [], foco: c.pos === "FW" ? "sho" : c.pos === "DF" ? "def" : "pas" };
  }

  // nota de 0 a 10 do dia: quem treina sem energia rende mal, e é aí que
  // aparece a lesão
  function fazDia(c, id) {
    var a = ATIV[id];
    var custo = a.custo;
    var notaBase = 6.2 + (c.energia - 60) / 16 + (c.overall - nivelElenco(c)) / 26;
    if (id === "fisio" || id === "descanso" || id === "pessoal" || id === "midia") notaBase = 0; // não é treino, não entra na média
    var nota = notaBase ? clamp(notaBase + (Math.random() * 3 - 1.5), 1, 10) : 0;

    c.energia = clamp(c.energia - custo, 0, 100);
    if (id === "pessoal") c.moral = clamp((c.moral || 60) + 6, 0, 100);
    if (id === "midia") { c.dinheiro = (c.dinheiro || 0) + 12000; c.fama = clamp((c.fama || 10) + 2, 0, 100); }

    // evolução de atributo
    if (a.attr) {
      var alvos = a.attr === "foco" ? [c.semana.foco] : a.attr;
      var ganho = (id === "extra" ? 0.46 : 0.26) * (nota / 7) * (c.age <= 20 ? 1.9 : c.age <= 23 ? 1.5 : c.age <= 29 ? 1 : 0.45);
      alvos.forEach(function (k) {
        c.prog = c.prog || {};
        c.prog[k] = (c.prog[k] || 0) + ganho;
        while (c.prog[k] >= 1 && c.attrs[k] < (c.potential || 99)) { c.attrs[k]++; c.prog[k] -= 1; }
      });
      c.overall = overallFrom(c.attrs, c.pos);
    }

    // lesão: cansaço multiplica o risco
    var risco = a.risco > 0 ? a.risco * (c.energia < 35 ? 3.2 : c.energia < 55 ? 1.8 : 1) : 0;
    var lesionou = false;
    if (risco > 0 && Math.random() < risco) {
      c.lesao = 1 + rnd(4);
      lesionou = true;
      TM.notify.push(c, { icon: "🚑", title: "Lesão no treino", text: "Você sentiu a coxa no " + a.nome.toLowerCase() + ". Fora por " + c.lesao + " jogo(s)." });
    }
    if (a.risco === -1) c.blindado = 2;

    c.semana.plano.push(id);
    if (nota) c.semana.notas.push(+nota.toFixed(1));
    save(c);
    return { nota: nota, lesionou: lesionou };
  }

  function mediaTreino(c) {
    var n = (c.semana && c.semana.notas) || [];
    if (!n.length) return 0;
    var s = 0; n.forEach(function (x) { s += x; });
    return +(s / n.length).toFixed(1);
  }
  // cumpriu a instrução do técnico se fez o treino pedido pelo menos 2x
  function cumpriuInstrucao(c) {
    var alvo = instrucaoDe(c).treino;
    var n = ((c.semana && c.semana.plano) || []).filter(function (x) { return x === alvo; }).length;
    return n >= 2;
  }

  // fecha a semana e joga tudo na barra
  function fechaSemana(c) {
    var m = mediaTreino(c);
    if (m >= 8) mexeConf(c, 3, "Semana de treino forte (" + m.toFixed(1) + ")");
    else if (m >= 6) mexeConf(c, 1, "Semana de treino boa (" + m.toFixed(1) + ")");
    else if (m > 0 && m < 5) mexeConf(c, -2, "Semana de treino fraca (" + m.toFixed(1) + ")");
    if (cumpriuInstrucao(c)) mexeConf(c, 2, "Cumpriu o que " + tecnico(c).nome + " pediu");
    else if ((c.semana.plano || []).length >= 4) mexeConf(c, -2, "Ignorou o pedido de " + tecnico(c).nome);
    recalcStatus(c);
    save(c);
  }

  /* =============== 5. O DIA DE JOGO =============== */

  function overallFrom(attrs, pos) {
    var w = pos === "GK" ? { def: .7, phy: .2, pas: .1 }
      : pos === "DF" ? { def: .5, phy: .25, pac: .15, pas: .1 }
      : pos === "FW" ? { sho: .4, pac: .2, dri: .25, phy: .1, pas: .05 }
      : { pas: .3, dri: .25, phy: .15, def: .15, sho: .1, pac: .05 };
    var s = 0; Object.keys(w).forEach(function (k) { s += (attrs[k] || 0) * w[k]; });
    return Math.round(s);
  }

  // a decisão do técnico vem SEMPRE com o motivo
  function escalacao(c) {
    if (c.lesao > 0) return { joga: "nao", min: 0, motivo: "Você está no departamento médico." };
    var r = rival(c), t = tecnico(c);
    var lim = limiar(c);
    var m = mediaTreino(c);
    switch (c.status) {
      case "intocavel":
        return { joga: "titular", min: 90, motivo: "Você é inquestionável no time de " + t.nome + "." };
      case "titular":
        return { joga: "titular", min: 80 + rnd(11),
                 motivo: m >= 7.5 ? "O trabalho da semana não passou batido — você começa jogando."
                       : "Você é titular e " + t.nome + " não viu motivo pra mexer." };
      case "alternativo":
        if (Math.random() < 0.45) return { joga: "titular", min: 62 + rnd(20), motivo: "Rodízio: " + (r ? r.name + " descansa" : "o titular descansa") + " e a vaga é sua hoje." };
        return { joga: "entra", min: 18 + rnd(22), motivo: (r ? r.name : "O titular") + " começa. Você entra no segundo tempo." };
      case "reserva":
        if (Math.random() < 0.40) return { joga: "entra", min: 6 + rnd(12), motivo: "Você entrou no fim, com o jogo decidido." };
        return { joga: "banco", min: 0, motivo: "Você ficou no banco os 90 minutos." };
      default:
        return { joga: "nao", min: 0, motivo: "Você nem foi relacionado. " + t.nome + " não conta com você." };
    }
  }

  // nível médio do elenco: a régua contra a qual sua atuação é julgada
  function nivelElenco(c) {
    var e = TM.data.clubPlayers(c.clubId) || [];
    if (!e.length) return c.overall;
    var s = 0; e.forEach(function (p) { s += p.overall; });
    return s / e.length;
  }
  // sua nota individual: o quanto você está acima ou abaixo do nível do time,
  // mais energia, resultado e sorte
  function notaIndividual(c, esc, venceu) {
    var base = 6.55;
    base += (c.overall - nivelElenco(c)) * 0.045;
    base += (c.energia - 60) * 0.006;
    base += venceu ? 0.35 : -0.15;
    base += (Math.random() * 2.6 - 1.3);
    if (esc.min < 25) base = 6.1 + (Math.random() * 1.2 - 0.5); // pouco tempo, nota morna
    return +clamp(base, 3.0, 10).toFixed(1);
  }

  function jogaPartida(c) {
    var esc = escalacao(c);
    var club = TM.data.club(c.clubId);
    var lg = TM.data.league(club.leagueId);
    var advId = pick(lg.clubIds.filter(function (id) { return id !== c.clubId; }));
    var adv = TM.data.club(advId);
    var casa = (c.rodada || 0) % 2 === 0;

    var res = TM.engine.simulate(
      TM.engine.teamFromClub(casa ? c.clubId : advId),
      TM.engine.teamFromClub(casa ? advId : c.clubId),
      { realism: 3, crowd: 0.55 }
    );
    var gm = casa ? res.score[0] : res.score[1];
    var gs = casa ? res.score[1] : res.score[0];
    var venceu = gm > gs;

    var out = { esc: esc, adv: adv.name, casa: casa, gm: gm, gs: gs, venceu: venceu, gols: 0, assist: 0, nota: 0, vermelho: false };

    if (esc.joga === "titular" || esc.joga === "entra") {
      out.nota = notaIndividual(c, esc, venceu);
      // gol e assistência proporcionais ao tempo em campo e à posição
      var pesoGol = c.pos === "FW" ? 0.42 : c.pos === "MF" ? 0.20 : c.pos === "DF" ? 0.07 : 0.004;
      var chance = pesoGol * (esc.min / 90) * (c.attrs.sho / 70) * (gm / 1.4);
      while (Math.random() < chance && out.gols < 3) { out.gols++; chance *= 0.35; }
      if (Math.random() < 0.16 * (esc.min / 90) * (c.attrs.pas / 70) * gm) out.assist = 1;
      out.nota = +clamp(out.nota + out.gols * 0.9 + out.assist * 0.5, 3, 10).toFixed(1);
      if (Math.random() < 0.012 * (esc.min / 90)) out.vermelho = true;

      c.energia = clamp(c.energia - (14 + esc.min * 0.28), 0, 100);
      c.seasonApps = (c.seasonApps || 0) + 1;
      c.seasonGoals = (c.seasonGoals || 0) + out.gols;
      c.seasonAssists = (c.seasonAssists || 0) + out.assist;
      c.ratings = ([out.nota]).concat(c.ratings || []).slice(0, 8);

      // a barra reage à atuação
      var d = out.nota >= 8 ? 8 : out.nota >= 7 ? 4 : out.nota >= 6.5 ? 2
            : out.nota >= 6 ? 1 : out.nota >= 5.5 ? -1 : out.nota >= 5 ? -3 : -7;
      mexeConf(c, d, "Nota " + out.nota.toFixed(1) + " contra o " + adv.name);
      if (out.gols) mexeConf(c, 2 * out.gols, out.gols + " gol(s) marcado(s)");
      if (out.assist) mexeConf(c, 2, "Assistência");
      if (out.vermelho) mexeConf(c, -10, "Cartão vermelho");
    } else {
      // você não jogou — e o concorrente jogou
      var r = rival(c);
      if (r && Math.random() < 0.42) mexeConf(c, -2, (r.name) + " foi bem no seu lugar");
      if (c.lesao > 0) { c.lesao--; mexeConf(c, -1, "Mais uma semana parado"); }
      c.energia = clamp(c.energia + 18, 0, 100);
    }

    c.rodada = (c.rodada || 0) + 1;
    // ninguém fica no topo de graça: a barra sempre puxa um pouco pro meio
    var regressao = (50 - c.conf) * 0.025;
    if (Math.abs(regressao) >= 0.5) c.conf = Math.round(clamp(c.conf + regressao, 0, 100));
    atualizaRival(c);
    var mudou = recalcStatus(c);
    out.mudouStatus = mudou;
    if (c.blindado) c.blindado--;

    // técnico demitido quando o time vai mal por muito tempo
    c.derrotasClube = venceu ? 0 : (c.derrotasClube || 0) + 1;
    if (c.derrotasClube >= 6 && Math.random() < 0.5) {
      c.derrotasClube = 0;
      novoTecnico(c, "A sequência ruim custou o cargo do anterior.");
      out.trocouTecnico = true;
    }

    comecaSemana(c);
    save(c);
    return out;
  }

  /* =============== TELAS =============== */

  function barraConf(c, compacta) {
    var lim = limiar(c), man = limiarManter(c);
    var st = STATUS[c.status] || STATUS.reserva;
    var falta = Math.max(0, lim - c.conf);
    var ehTit = c.status === "titular" || c.status === "intocavel";
    var ultimo = (c.confLog || [])[0];

    var trilho = el("div", { class: "rae-bar" }, [
      el("div", { class: "rae-bar-fill " + st.css, style: "width:" + c.conf + "%" }),
      el("div", { class: "rae-bar-mark", style: "left:" + lim + "%", title: "titular a partir de " + lim }),
      ehTit ? el("div", { class: "rae-bar-mark keep", style: "left:" + man + "%", title: "perde a vaga abaixo de " + man }) : null
    ]);

    var legenda = ehTit
      ? "Perde a vaga se cair abaixo de " + man
      : (falta > 0 ? "Faltam " + falta + " pontos para ser titular" : "Você alcançou o limiar");

    return el("div", { class: "rae-conf" + (compacta ? " compacta" : "") }, [
      el("div", { class: "rae-conf-top" }, [
        el("span", { class: "rae-conf-lbl", text: "CONFIANÇA DO TÉCNICO" }),
        el("span", { class: "rae-conf-val", text: c.conf + " / 100" })
      ]),
      trilho,
      el("div", { class: "rae-conf-sub" }, [
        el("span", { class: "rae-status " + st.css, text: st.ic + " " + st.nome }),
        el("span", { class: "rae-conf-hint", text: legenda })
      ]),
      ultimo && ultimo.d ? el("div", { class: "rae-conf-last" }, [
        el("span", { class: "rae-delta " + (ultimo.d > 0 ? "up" : "down"), text: (ultimo.d > 0 ? "+" : "") + ultimo.d }),
        el("span", { class: "rae-delta-txt", text: ultimo.por })
      ]) : null
    ]);
  }

  /* ---------- entrada ---------- */
  TM.ui.register("rae", function (screen) {
    var c = car();
    screen.appendChild(TM.ui.topbar("🌟 Rumo ao Estrelato", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("div", { class: "rae-intro" }, [
      el("div", { class: "rae-intro-t", text: "Do banco ao estrelato" }),
      el("div", { class: "rae-intro-d", text: "A semana é o jogo. Você tem energia limitada, um concorrente com nome e um técnico que forma uma opinião sua — e ela sobe e desce." })
    ]));
    if (c) {
      body.appendChild(TM.ui.button("▶ Continuar — " + c.name + " · " + c.clubName, function () { TM.ui.go("rae-hub"); }, "primary"));
      body.appendChild(TM.ui.button("🗑️ Apagar e começar outra", function () {
        TM.ui.confirm("Apagar a carreira?", "Todo o progresso de " + c.name + " será perdido.", "Apagar", function () { limpa(); TM.ui.go("rae"); }, true);
      }));
    } else {
      body.appendChild(TM.ui.button("✨ Nova carreira", function () { TM.ui.go("rae-create"); }, "primary"));
    }
  });

  /* ---------- criação ---------- */
  TM.ui.register("rae-create", function (screen) {
    screen.appendChild(TM.ui.topbar("Criar jogador", function () { TM.ui.go("rae"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);

    var f = { nome: "", pos: "FW", idade: 18, clubId: null, foco: "sho" };

    function campo(lbl, node) { return el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: lbl }), node ]); }

    var inNome = el("input", { class: "text-input", type: "text", placeholder: "Seu nome", maxlength: "22" });
    inNome.addEventListener("input", function () { f.nome = inNome.value; });
    body.appendChild(campo("Nome", inNome));

    var seg = el("div", { class: "segmented full" });
    [["GK", "Goleiro"], ["DF", "Defensor"], ["MF", "Meia"], ["FW", "Atacante"]].forEach(function (o) {
      var b = el("button", { class: "seg-btn" + (o[0] === f.pos ? " on" : ""), text: o[1], on: { click: function () {
        f.pos = o[0];
        f.foco = o[0] === "FW" ? "sho" : o[0] === "DF" ? "def" : o[0] === "GK" ? "def" : "pas";
        Array.prototype.forEach.call(seg.children, function (x) { x.classList.remove("on"); });
        b.classList.add("on");
      } } });
      seg.appendChild(b);
    });
    body.appendChild(campo("Posição", seg));

    var selIdade = el("select", { class: "select" });
    for (var i = 16; i <= 24; i++) selIdade.appendChild(el("option", { value: i, text: i + " anos" }));
    selIdade.value = 18;
    selIdade.addEventListener("change", function () { f.idade = +selIdade.value; });
    body.appendChild(campo("Idade", selIdade));

    var selLiga = el("select", { class: "select" });
    TM.data.world().leagues.forEach(function (lg) { selLiga.appendChild(el("option", { value: lg.id, text: lg.name })); });
    var selClube = el("select", { class: "select" });
    function enche() {
      TM.ui.clear(selClube);
      TM.data.league(selLiga.value).clubIds.map(TM.data.club)
        .sort(function (a, b) { return TM.data.clubRating(a.id) - TM.data.clubRating(b.id); })
        .forEach(function (cl) { selClube.appendChild(el("option", { value: cl.id, text: cl.name + " · força " + TM.data.clubRating(cl.id) })); });
      f.clubId = selClube.value;
    }
    selLiga.addEventListener("change", enche);
    selClube.addEventListener("change", function () { f.clubId = selClube.value; });
    enche();
    body.appendChild(campo("Liga", selLiga));
    body.appendChild(campo("Clube", selClube));
    body.appendChild(el("div", { class: "setting-hint", text: "Quanto mais forte o clube, mais dura a briga por vaga — o limiar para ser titular acompanha quem está na sua frente." }));

    body.appendChild(TM.ui.button("Começar", function () {
      if (!f.nome.trim()) { TM.ui.toast("Escolha um nome."); return; }
      cria(f);
    }, "primary"));
  });

  function cria(f) {
    var club = TM.data.club(f.clubId);
    var forca = TM.data.clubRating(f.clubId);
    // um moleque de 18 é um moleque de 18 em qualquer lugar — o que muda é o
    // tamanho da fila na frente dele
    var base = clamp(Math.round(42 + (forca - 55) * 0.45 + rnd(5)), 40, 66);
    var attrs = { pac: base, sho: base, pas: base, dri: base, def: base, phy: base };
    if (f.pos === "GK") { attrs.def = base + 6; attrs.sho = base - 25; }
    if (f.pos === "DF") { attrs.def += 6; attrs.sho -= 8; }
    if (f.pos === "FW") { attrs.sho += 8; attrs.def -= 12; attrs.pac += 4; }
    if (f.pos === "MF") { attrs.pas += 6; }
    Object.keys(attrs).forEach(function (k) { attrs[k] = clamp(attrs[k], 20, 99); });

    var c = {
      v: 1, id: "rae-me", name: f.nome.trim(), pos: f.pos, age: f.idade,
      nationName: (TM.data.league(club.leagueId) || {}).nation || "",
      attrs: attrs, overall: overallFrom(attrs, f.pos), potential: clamp(base + 12 + rnd(14), 60, 94),
      clubId: club.id, clubName: club.name, leagueId: club.leagueId,
      season: 1, seasonYear: ANO, rodada: 0,
      seasonApps: 0, seasonGoals: 0, seasonAssists: 0, ratings: [],
      energia: 100, moral: 65, fama: 8, dinheiro: 0, lesao: 0,
      conf: 0, confLog: [], status: "reserva", prog: {},
      notifications: []
    };
    tecnico(c);
    // garoto chegando: a barra começa baixa e o limiar já diz o tamanho da briga
    c.conf = Math.round(clamp(18 + (c.overall - base) * 2, 8, 40));
    recalcStatus(c);
    comecaSemana(c);
    TM.notify.push(c, { icon: "🌟", title: "Bem-vindo ao profissional",
      text: "Você foi integrado ao elenco do " + club.name + ". " + tecnico(c).nome + " é quem decide quem joga." });
    save(c);
    TM.ui.go("rae-hub");
  }

  /* ---------- central ---------- */
  TM.ui.register("rae-hub", function (screen) {
    var c = car();
    if (!c) { TM.ui.go("rae"); return; }
    var club = TM.data.club(c.clubId);
    var r = rival(c);

    var dots = el("button", { class: "tb-menu", text: "⋯", on: { click: function () {
      TM.ui.optionsMenu("Carreira", [
        { label: "💾 Salvar", fn: function () { save(c); TM.ui.toast("✔ Salvo"); } },
        { label: "🏠 Menu principal", fn: function () { TM.ui.go("modes"); } },
        { label: "🗑️ Apagar carreira", danger: true, fn: function () {
          TM.ui.confirm("Apagar?", "Todo o progresso será perdido.", "Apagar", function () { limpa(); TM.ui.go("modes"); }, true);
        } }
      ]);
    } } });
    screen.appendChild(TM.ui.topbar(c.name, function () { TM.ui.go("modes"); }, el("div", { class: "tb-actions" }, [ dots ])));

    var body = el("div", { class: "rae-body" });
    screen.appendChild(body);

    // cartão
    body.appendChild(el("div", { class: "rae-card" }, [
      el("div", { class: "rae-card-l" }, [
        el("div", { class: "rae-name", text: c.name }),
        el("div", { class: "rae-sub", text: (TM.data.posLabel ? TM.data.posLabel(c) : c.pos) + " · " + c.age + " anos" }),
        el("div", { class: "rae-club" }, [ TM.img.clubImg(club, "rae-crest"), el("span", { text: club.name }) ])
      ]),
      TM.ui.ovBadge(c.overall)
    ]));

    // A BARRA
    body.appendChild(barraConf(c));

    // energia
    var eCss = c.energia >= 70 ? "ok" : c.energia >= 40 ? "mid" : "low";
    body.appendChild(el("div", { class: "rae-energia" }, [
      el("div", { class: "rae-en-top" }, [
        el("span", { text: "⚡ Energia" }),
        el("span", { class: "rae-en-val " + eCss, text: Math.round(c.energia) + "%" })
      ]),
      el("div", { class: "rae-en-bar" }, [ el("div", { class: "rae-en-fill " + eCss, style: "width:" + c.energia + "%" }) ]),
      c.energia < 40 ? el("div", { class: "rae-warn", text: "⚠️ Abaixo de 40% você rende mal e o risco de lesão dispara." }) : null
    ]));

    if (c.lesao > 0) body.appendChild(el("div", { class: "rae-warn big", text: "🚑 Lesionado — fora por " + c.lesao + " jogo(s)." }));

    // o concorrente
    if (r) {
      body.appendChild(el("div", { class: "rae-rival", on: { click: function () { TM.ui.go("rae-elenco"); } } }, [
        el("div", { class: "rae-rival-h", text: "🥊 " + lugarNaFila(c) + "º na disputa · seu concorrente direto" }),
        el("div", { class: "rae-rival-b" }, [
          TM.img.playerImg(r, "rae-rival-face"),
          el("div", { class: "rae-rival-i" }, [
            el("div", { class: "rae-rival-n", text: r.name }),
            el("div", { class: "rae-rival-s", text: r.age + " anos · overall " + r.overall })
          ]),
          el("span", { class: "rae-go", text: "ver elenco →" })
        ])
      ]));
    }

    // números da temporada
    function tile(l, v) { return el("div", { class: "tile" }, [ el("div", { class: "tile-val", text: v }), el("div", { class: "tile-lbl", text: l }) ]); }
    var media = (c.ratings || []).length ? (c.ratings.reduce(function (a, b) { return a + b; }, 0) / c.ratings.length).toFixed(1) : "—";
    body.appendChild(el("div", { class: "stat-tiles" }, [
      tile("Jogos", c.seasonApps || 0), tile("Gols", c.seasonGoals || 0),
      tile("Assist.", c.seasonAssists || 0), tile("Média", media)
    ]));

    // ações
    var dias = (c.semana && (c.semana.dias - c.semana.plano.length)) || 0;
    body.appendChild(TM.ui.button(dias > 0 ? "📅 Treinar a semana — " + dias + " dia(s)" : "⚽ Dia de jogo", function () {
      TM.ui.go(dias > 0 ? "rae-semana" : "rae-jogo");
    }, "primary"));
    body.appendChild(TM.ui.button("👔 " + tecnico(c).nome, function () { TM.ui.go("rae-tecnico"); }));
    body.appendChild(TM.ui.button("👥 Elenco e concorrência", function () { TM.ui.go("rae-elenco"); }));
    body.appendChild(TM.ui.button("📈 Histórico da barra", function () { TM.ui.go("rae-log"); }));
  });

  /* ---------- a semana ---------- */
  TM.ui.register("rae-semana", function (screen) {
    var c = car();
    if (!c) { TM.ui.go("rae"); return; }
    if (!c.semana) comecaSemana(c);
    screen.appendChild(TM.ui.topbar("📅 A semana", function () { TM.ui.go("rae-hub"); }));
    var body = el("div", { class: "rae-body" });
    screen.appendChild(body);

    var restam = c.semana.dias - c.semana.plano.length;
    var inst = instrucaoDe(c);

    body.appendChild(el("div", { class: "rae-week-h" }, [
      el("span", { class: "rae-week-d", text: restam > 0 ? restam + " dia(s) até o jogo" : "Semana encerrada" }),
      el("span", { class: "rae-week-e", text: "⚡ " + Math.round(c.energia) + "%" })
    ]));

    body.appendChild(el("div", { class: "rae-inst" }, [
      el("div", { class: "rae-inst-h", text: "👔 " + tecnico(c).nome + " pediu:" }),
      el("div", { class: "rae-inst-t", text: "“" + inst.txt + "”" }),
      el("div", { class: "rae-inst-s" + (cumpriuInstrucao(c) ? " ok" : ""), text: cumpriuInstrucao(c) ? "✔ Cumprido nesta semana (+2)" : "Faça " + ATIV[inst.treino].nome + " ao menos 2x nesta semana" })
    ]));

    // o que já foi feito
    if (c.semana.plano.length) {
      body.appendChild(el("div", { class: "rae-feito" }, c.semana.plano.map(function (id, i) {
        var n = c.semana.notas[i];
        return el("span", { class: "rae-chip", text: ATIV[id].ic + " " + (n ? n.toFixed(1) : "—") });
      })));
    }

    if (restam <= 0) {
      body.appendChild(el("div", { class: "rae-week-end" }, [
        el("div", { text: "Média de treino: " + (mediaTreino(c) || "—") }),
        el("div", { class: "setting-hint", text: "É o que o técnico leva em conta pra montar a escalação." })
      ]));
      body.appendChild(TM.ui.button("⚽ Ir para o jogo", function () { fechaSemana(c); TM.ui.go("rae-jogo"); }, "primary"));
      return;
    }

    // foco do treino técnico
    var focos = [["pac", "Velocidade"], ["sho", "Finalização"], ["pas", "Passe"], ["dri", "Drible"], ["def", "Defesa"], ["phy", "Físico"]];
    var selFoco = el("select", { class: "select" });
    focos.forEach(function (o) { selFoco.appendChild(el("option", { value: o[0], text: o[1] + " (" + c.attrs[o[0]] + ")" })); });
    selFoco.value = c.semana.foco;
    selFoco.addEventListener("change", function () { c.semana.foco = selFoco.value; save(c); });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "🎯 Foco do treino técnico e do trabalho extra" }), selFoco ]));

    // atividades
    var lista = el("div", { class: "rae-ativs" });
    ORDEM_ATIV.forEach(function (id) {
      var a = ATIV[id];
      var caro = a.custo > 0 && c.energia < a.custo;
      var ehPedido = inst.treino === id;
      var card = el("button", { class: "rae-ativ" + (caro ? " sem-energia" : "") + (ehPedido ? " pedido" : ""), on: { click: function () {
        if (caro) { TM.ui.toast("Sem energia pra isso hoje."); return; }
        var r = fazDia(c, id);
        if (r.lesionou) TM.ui.toast("🚑 Você se lesionou no treino!");
        else if (r.nota) TM.ui.toast(a.ic + " " + a.nome + " — nota " + r.nota.toFixed(1));
        else TM.ui.toast(a.ic + " " + a.nome);
        TM.ui.go("rae-semana");
      } } }, [
        el("span", { class: "rae-ativ-ic", text: a.ic }),
        el("span", { class: "rae-ativ-i" }, [
          el("span", { class: "rae-ativ-n", text: a.nome + (ehPedido ? "  ⭐" : "") }),
          el("span", { class: "rae-ativ-d", text: a.desc })
        ]),
        el("span", { class: "rae-ativ-c " + (a.custo > 0 ? "gasta" : "ganha"), text: (a.custo > 0 ? "−" : "+") + Math.abs(a.custo) })
      ]);
      lista.appendChild(card);
    });
    body.appendChild(lista);
  });

  /* ---------- dia de jogo ---------- */
  TM.ui.register("rae-jogo", function (screen) {
    var c = car();
    if (!c) { TM.ui.go("rae"); return; }
    if (c.semana && c.semana.plano.length < c.semana.dias) { TM.ui.go("rae-semana"); return; }
    screen.appendChild(TM.ui.topbar("⚽ Dia de jogo", function () { TM.ui.go("rae-hub"); }));
    var body = el("div", { class: "rae-body" });
    screen.appendChild(body);

    var esc = escalacao(c);
    var cls = esc.joga === "titular" ? "tit" : esc.joga === "entra" ? "alt" : "out";
    var titulo = esc.joga === "titular" ? "✅ Você é titular"
      : esc.joga === "entra" ? "🔄 Você começa no banco"
      : esc.joga === "banco" ? "🪑 Você fica no banco" : "🚫 Você não foi relacionado";

    body.appendChild(el("div", { class: "rae-esc " + cls }, [
      el("div", { class: "rae-esc-t", text: titulo }),
      el("div", { class: "rae-esc-m", text: "“" + esc.motivo + "”" }),
      el("div", { class: "rae-esc-w", text: "— " + tecnico(c).nome })
    ]));

    body.appendChild(barraConf(c, true));

    body.appendChild(TM.ui.button("▶ Jogar a partida", function () {
      var out = jogaPartida(c);
      TM.ui.go("rae-resultado", { out: out });
    }, "primary"));
  });

  TM.ui.register("rae-resultado", function (screen, params) {
    var c = car();
    var out = params && params.out;
    if (!c || !out) { TM.ui.go("rae-hub"); return; }
    screen.appendChild(TM.ui.topbar("Fim de jogo", function () { TM.ui.go("rae-hub"); }));
    var body = el("div", { class: "rae-body" });
    screen.appendChild(body);

    var placar = out.casa ? (out.gm + " × " + out.gs) : (out.gs + " × " + out.gm);
    body.appendChild(el("div", { class: "rae-res " + (out.venceu ? "v" : out.gm === out.gs ? "e" : "d") }, [
      el("div", { class: "rae-res-p", text: placar }),
      el("div", { class: "rae-res-s", text: (out.casa ? c.clubName + " × " + out.adv : out.adv + " × " + c.clubName) })
    ]));

    if (out.esc.joga === "titular" || out.esc.joga === "entra") {
      body.appendChild(el("div", { class: "rae-minha" }, [
        el("div", { class: "rae-minha-h", text: "Sua partida" }),
        el("div", { class: "rae-minha-g" }, [
          el("div", { class: "tile" }, [ el("div", { class: "tile-val", text: out.nota.toFixed(1) }), el("div", { class: "tile-lbl", text: "Nota" }) ]),
          el("div", { class: "tile" }, [ el("div", { class: "tile-val", text: out.esc.min + "'" }), el("div", { class: "tile-lbl", text: "Minutos" }) ]),
          el("div", { class: "tile" }, [ el("div", { class: "tile-val", text: out.gols }), el("div", { class: "tile-lbl", text: "Gols" }) ]),
          el("div", { class: "tile" }, [ el("div", { class: "tile-val", text: out.assist }), el("div", { class: "tile-lbl", text: "Assist." }) ])
        ]),
        out.vermelho ? el("div", { class: "rae-warn big", text: "🟥 Você foi expulso." }) : null
      ]));
    } else {
      body.appendChild(el("div", { class: "rae-minha" }, [ el("div", { class: "rae-minha-h", text: "Você não entrou em campo." }) ]));
    }

    // o que a partida fez com a barra
    var recentes = (c.confLog || []).filter(function (l) { return l.r >= (c.rodada - 1); });
    if (recentes.length) {
      body.appendChild(el("div", { class: "rae-log" }, [ el("div", { class: "rae-log-h", text: "📊 O que mudou na confiança" }) ].concat(
        recentes.map(function (l) {
          return el("div", { class: "rae-log-row" }, [
            el("span", { class: "rae-delta " + (l.d > 0 ? "up" : "down"), text: (l.d > 0 ? "+" : "") + l.d }),
            el("span", { class: "rae-log-t", text: l.por })
          ]);
        })
      )));
    }
    body.appendChild(barraConf(c, true));

    if (out.mudouStatus) {
      var st = STATUS[c.status];
      body.appendChild(el("div", { class: "rae-flash " + st.css, text: st.ic + " Novo status: " + st.nome + " — " + st.desc }));
    }
    if (out.trocouTecnico) body.appendChild(el("div", { class: "rae-flash rae-st-out", text: "👔 Técnico demitido. " + tecnico(c).nome + " assumiu e a barra recomeçou." }));

    body.appendChild(TM.ui.button("📅 Próxima semana", function () { TM.ui.go("rae-semana"); }, "primary"));
  });

  /* ---------- técnico ---------- */
  TM.ui.register("rae-tecnico", function (screen) {
    var c = car(); if (!c) { TM.ui.go("rae"); return; }
    var t = tecnico(c), tp = TIPOS_TEC[t.tipo];
    screen.appendChild(TM.ui.topbar("👔 " + t.nome, function () { TM.ui.go("rae-hub"); }));
    var body = el("div", { class: "rae-body" });
    screen.appendChild(body);

    body.appendChild(el("div", { class: "rae-tec" }, [
      el("div", { class: "rae-tec-n", text: t.nome }),
      el("div", { class: "rae-tec-tp", text: tp.nome }),
      el("div", { class: "rae-tec-d", text: tp.desc })
    ]));
    body.appendChild(barraConf(c));
    body.appendChild(el("div", { class: "rae-inst" }, [
      el("div", { class: "rae-inst-h", text: "O que ele pede de você" }),
      el("div", { class: "rae-inst-t", text: "“" + instrucaoDe(c).txt + "”" })
    ]));

    var lim = limiar(c), r = rival(c);
    body.appendChild(el("div", { class: "rae-expl" }, [
      el("div", { class: "rae-expl-h", text: "🧮 Por que o limiar é " + lim }),
      el("div", { class: "rae-expl-b", text: r
        ? "Você tem overall " + c.overall + " e " + r.name + " tem " + r.overall + ". Cada ponto de diferença mexe 3 no limiar. Encostar no overall dele derruba a exigência."
        : "Não há concorrente direto no elenco para a sua posição — a vaga é sua para perder." })
    ]));
  });

  /* ---------- elenco ---------- */
  TM.ui.register("rae-elenco", function (screen) {
    var c = car(); if (!c) { TM.ui.go("rae"); return; }
    screen.appendChild(TM.ui.topbar("👥 A fila da sua posição", function () { TM.ui.go("rae-hub"); }));
    var body = el("div", { class: "rae-body" });
    screen.appendChild(body);

    var lista = concorrentes(c);
    var eu = { name: c.name, overall: c.overall, age: c.age, pos: c.pos, id: c.id, _eu: true };
    var todos = lista.concat([eu]).sort(function (a, b) { return b.overall - a.overall; });

    body.appendChild(el("div", { class: "setting-hint", text: "Toque em alguém para escolher quem você quer encarar como concorrente direto. É o overall dele que define o seu limiar." }));

    todos.forEach(function (p, i) {
      var ehEu = !!p._eu;
      var ehRival = !ehEu && p.id === c.rivalId;
      body.appendChild(el("button", { class: "rae-fila" + (ehEu ? " eu" : "") + (ehRival ? " alvo" : ""), on: { click: function () {
        if (ehEu) return;
        c.rivalId = p.id; recalcStatus(c); save(c);
        TM.ui.toast("Concorrente direto: " + p.name + " — limiar agora é " + limiar(c));
        TM.ui.go("rae-elenco");
      } } }, [
        el("span", { class: "rae-fila-p", text: (i + 1) + "º" }),
        el("span", { class: "rae-fila-n", text: p.name + (ehEu ? "  (você)" : "") }),
        el("span", { class: "rae-fila-a", text: p.age + "a" }),
        el("span", { class: "rae-fila-o", text: p.overall }),
        ehRival ? el("span", { class: "rae-fila-tag", text: "🥊" }) : null
      ]));
    });
  });

  /* ---------- histórico da barra ---------- */
  TM.ui.register("rae-log", function (screen) {
    var c = car(); if (!c) { TM.ui.go("rae"); return; }
    screen.appendChild(TM.ui.topbar("📈 Histórico da confiança", function () { TM.ui.go("rae-hub"); }));
    var body = el("div", { class: "rae-body" });
    screen.appendChild(body);
    body.appendChild(barraConf(c));
    var log = c.confLog || [];
    if (!log.length) { body.appendChild(el("div", { class: "setting-hint", text: "Nada registrado ainda." })); return; }
    body.appendChild(el("div", { class: "rae-log" }, log.map(function (l) {
      return el("div", { class: "rae-log-row" }, [
        el("span", { class: "rae-delta " + (l.d > 0 ? "up" : l.d < 0 ? "down" : ""), text: (l.d > 0 ? "+" : "") + l.d }),
        el("span", { class: "rae-log-t", text: l.por })
      ]);
    })));
  });

  /* ---------- API ---------- */
  TM.rae = {
    limiar: limiar, limiarManter: limiarManter, recalcStatus: recalcStatus, mexeConf: mexeConf,
    tecnico: tecnico, novoTecnico: novoTecnico, rival: rival, concorrentes: concorrentes,
    comecaSemana: comecaSemana, fazDia: fazDia, fechaSemana: fechaSemana, mediaTreino: mediaTreino,
    escalacao: escalacao, jogaPartida: jogaPartida, cria: cria, atualizaRival: atualizaRival, nivelElenco: nivelElenco,
    carreira: car, salva: save, ATIV: ATIV, STATUS: STATUS, TIPOS_TEC: TIPOS_TEC
  };
})(window);
