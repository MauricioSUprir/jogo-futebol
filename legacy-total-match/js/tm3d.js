/* ================= TOTAL MATCH 3D — partidas em 3D =================
   O jogo é um só: o Total Match. O motor 3D (pasta golaco/, no mesmo site — o GOLAÇO novo) roda a
   partida do seu time quando você escolhe "Jogar em 3D". O motor antigo (futebol3d/) continua
   publicado como reserva e lê os mesmos campos da versão 1 do pedido.

   Como os dois conversam (mesmo endereço = mesmo armazenamento do navegador):
     TM → localStorage["tm3d:pedido:<id>"] = { v, id, titulo, home, away, userSide, controle, partida }
          e abre o 3D num quadro (iframe) por cima do TM: golaco/index.html?tm=<id>
     3D → window.parent.postMessage({ tipo: "tm3d:pronto" | "tm3d:fim" | "tm3d:sair", id, resultado })
          (o resultado também fica em localStorage["tm3d:resultado:<id>"], se a mensagem se perder)
   Cada time leva nome, sigla, cores, uniformes, os jogadores (11 titulares na ordem da prancheta
   + reservas) com atributos, posição e aparência, e a identidade (v2): o MESMO escudo que o TM
   mostra (TM.img.clubImg/nationImg; Ultimate: o escudo desenhado), bandeira, liga, técnico e o
   estádio (nome, capacidade, foto). A partida leva mando neutro, público e clássico (simOpts).
   Cada jogador leva o tmId: o resultado volta com quem marcou de verdade.
   O 3D cuida só dos 90 minutos; prorrogação e pênaltis continuam com o Total Match.
   resultado = { homeGoals, awayGoals, gols: [{ lado: 0|1, tmId, nome, minuto, penalti, contra, assist }],
                 cartoes: [{ lado, tmId, nome, minuto, cor }], stats: { possession, shots, onTarget },
                 jogador?: { tmId, nota, gols, assist } }   (o lado do 3D está em golaco/js/ponte-tm.js)
   Se o 3D não abrir (sem WebGL 2, sem internet para o three.js), a partida é simulada.
   Pênaltis 3D (dono, 15/10: "modo de pênaltis 3d igual ao golaço, só que versão de pênaltis"; js/penaltis3d.js): o mesmo
   pedido com modo: "penaltis" abre só a DISPUTA de pênaltis (Regra 10 da IFAB) com os dois times; o usuário bate com os
   cobradores do time dele e defende com o goleiro dele. Resultado (sem homeGoals):
   { penaltis: { vencedor: 0|1, placar: [casa, fora], cobrancas: [{ lado, tmId, nome, resultado: "gol"|"defesa"|"fora" }] } }
   Modo Livre 3D (dono, 16/10: "um modo livre, como no fifa, um modo de treino ... a quantidade de jogadores que eu escolher";
   js/livre3d.js): o mesmo pedido com modo: "livre" abre o treino livre (sem relógio, quantos jogadores em cada time e a
   câmera escolhidos na pausa do 3D), sem trava ("só o meu jogador") e, se vier, com a escolha inicial
   livre: { linha: [casa, fora] (0–10; o time do usuário ≥ 1), goleiro: [bool, bool] }. Não tem resultado: tanto
   'tm3d:sair' quanto 'tm3d:fim' ({ livre: { placar } }) só voltam à tela do modo — nada conta.
   Online 3D (dono, 16/10: "duas pessoas consigam jogar uma contra a outra"; js/online3d.js): o pedido pronto, montado pelo
   anfitrião da sala, com modo: "online" e online: { sala, semente, nomes, D0, proto, lado } (TM.tm3d.jogarOnline). A
   ligação entre os aparelhos fica na página do TM: a cada 'tm3d:pronto' (ou 'tm3d:pedePorta') o quadro recebe uma
   MessagePort ('tm3d:porta'; o protocolo está no topo de js/online3d.js). O fim volta com os dados da mensagem
   (fns.fim(resultado, dados) / fns.sair(dados): dados.abandono, dados.online). */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  var api = {
    PASTA: "golaco/index.html",            // os testes trocam por uma página de ensaio
    ESPERA_MS: 30000                          // sem sinal do 3D nesse tempo: oferece simular
  };

  /* ---------- utilidades ---------- */
  // o motor 3D (golaco/) precisa de WebGL 2
  function webgl() {
    try { var c = document.createElement("canvas"); return !!c.getContext("webgl2"); } catch (e) { return false; }
  }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function sorteio(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function escolhe(arr, r) { return arr[Math.floor(r() * arr.length)]; }
  function rgb(h) { h = String(h || "#888888").replace("#", ""); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lum(h) { var c = rgb(h); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function dist(a, b) { var x = rgb(a), y = rgb(b); return Math.sqrt(Math.pow(x[0] - y[0], 2) + Math.pow(x[1] - y[1], 2) + Math.pow(x[2] - y[2], 2)); }
  function tom(h, f) { var c = rgb(h).map(function (v) { return Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); }); return "#" + c.map(function (v) { return (v < 16 ? "0" : "") + v.toString(16); }).join(""); }
  function contraste(h) { return lum(h) > 0.55 ? "#111111" : "#ffffff"; }
  // mesmo clarear/escurecer dos uniformes do TM (placeholders.js)
  function soma(h, d) { var c = rgb(h).map(function (v) { v = Math.max(0, Math.min(255, Math.round(v + d))); return (v < 16 ? "0" : "") + v.toString(16); }); return "#" + c.join(""); }
  function clareia(h, pct) { return soma(h, Math.round(255 * pct / 100)); }
  function escurece(h, pct) { return soma(h, -Math.round(255 * pct / 100)); }

  /* ---------- preferência (Config) ---------- */
  function preferencia() { try { return TM.storage.settings().partidas3d || "perguntar"; } catch (e) { return "perguntar"; } }
  function salvaPreferencia(v) { try { var s = TM.storage.settings(); s.partidas3d = v; TM.storage.saveSettings(s); } catch (e) {} }

  /* ---------- time do TM → time do 3D ---------- */
  var POS_3D = { GOL: "GOL", ZAG: "ZAG", LD: "LD", LE: "LE", VOL: "VOL", MC: "MC", MEI: "MEI", MD: "MD", ME: "ME", CA: "CA", SA: "ATA", PD: "PD", PE: "PE" };
  var POS_SETOR = { GK: "GOL", DF: "ZAG", MF: "MC", FW: "CA" };
  // o 3D tem 4 desenhos táticos: cada formação do TM vai para o mais parecido
  var FORM_3D = { "4-3-3": "4-3-3", "4-2-3-1": "4-2-3-1", "4-4-2": "4-4-2", "3-5-2": "3-5-2",
    "4-1-4-1": "4-2-3-1", "4-5-1": "4-2-3-1", "4-4-1-1": "4-2-3-1", "4-1-2-1-2": "4-4-2", "4-2-2-2": "4-4-2", "4-2-4": "4-4-2",
    "3-4-3": "3-5-2", "3-4-1-2": "3-5-2", "3-4-2-1": "3-5-2", "5-3-2": "3-5-2", "5-4-1": "3-5-2", "5-2-3": "3-5-2" };
  var PELES = ["#f2d2bb", "#e8bf9f", "#dcaa85", "#c99169", "#b27a52", "#96603d", "#7a4a2d", "#5c3620", "#462817"];
  var CABELOS = ["#15110e", "#2e1f15", "#4d321e", "#79542f", "#b48d52", "#8f4a22"];
  var GOLEIRO = ["#c9e83a", "#2a9d5c", "#6b6f7a", "#d63b6a", "#f5a524", "#3a7bd5", "#9b5de5", "#ff7a00"];
  var FORMAS = ["heater", "badge", "clipped", "french", "hex", "oval", "roundel", "scallop"];
  var MOTIVOS = ["plain", "stripes", "halves", "hoops", "pales", "rays", "sash"];
  var EMBLEMAS = ["anchor", "falcon", "helm", "locomotive", "palm", "sun", "tower", "wolf"];

  function nomeCurto(n) {
    var a = String(n || "").trim().split(/\s+/);
    if (a.length < 2) return a[0] || "Jogador";
    return a[0][0] + ". " + a.slice(1).join(" ");
  }
  // aparência fixa por jogador (mesma em todo jogo): o 3D escolhe o rosto por ela
  function aparencia(p) {
    var r = sorteio(hash("look" + p.id));
    var si = Math.floor(r() * PELES.length), escura = si >= 5;
    var hc = escura ? (r() < 0.9 ? CABELOS[0] : CABELOS[1]) : CABELOS[Math.min(CABELOS.length - 1, Math.floor(Math.pow(r(), 1.4) * CABELOS.length))];
    var estilos = escura ? ["short", "buzz", "curly", "afro", "bald", "short", "buzz", "bun"] : ["short", "short", "buzz", "curly", "long", "bald", "bun", "short"];
    var alt = p.height ? p.height / 100 : 1.70 + r() * 0.2;
    var imc = (p.weight && p.height) ? p.weight / Math.pow(p.height / 100, 2) : 21.5 + r() * 3;
    return { skin: PELES[si], hair: escolhe(estilos, r), hairColor: hc, height: Math.round(alt * 100) / 100,
             build: Math.max(0, Math.min(1, (imc - 20) / 6)), beard: r() < 0.3 };
  }
  function jogador3d(p, i, vaga) {
    var r = sorteio(hash("pe" + p.id)), a = p.attrs || {};
    var pos = POS_3D[p.pos2] || POS_SETOR[p.pos] || "MC", gol = p.pos === "GK";
    var esq = /^(LE|PE|ME)$/.test(pos) ? r() < 0.75 : r() < 0.2;
    var nota = p.overall || 60;
    var j = {
      tmId: p.id, name: nomeCurto(p.name), nomeCompleto: p.name, num: p.number || (i + 1), pos: pos,
      attrs: { pac: a.pac || nota, sho: a.sho || nota, pas: a.pas || nota, dri: a.dri || nota, def: a.def || nota, phy: a.phy || nota,
               gk: gol ? nota : 8 + Math.floor(r() * 14) },
      overall: nota, foot: esq ? "E" : "D", look: aparencia(p)
    };
    if (vaga) j.slot = [vaga[0], vaga[1], vaga[2]];   // vaga na prancheta do TM: o 3D põe cada um no lugar mais parecido
    return j;
  }
  // 11 titulares (na ordem das vagas da formação) + reservas. Time sem escalação montada
  // (adversário da carreira vem ordenado por nota) passa pelo montador de escalação do TM.
  function escalacao(time, formacao) {
    var ps = (time.players || []).filter(Boolean);
    var F = (TM.comp && TM.comp.FORMATIONS) || {};
    var xi = ps.slice(0, 11);
    var gols = xi.filter(function (p) { return p.pos === "GK"; }).length;
    // escalação montada pelo usuário (formação ou posições do time): vale como está, sem o montador
    var doUsuario = !!(time.formation || time.posicoes);
    var pronta = !!F[formacao] && xi.length === 11 && (doUsuario || (gols === 1 && xi[0].pos === "GK"));
    var remontada = false;
    if (!pronta && TM.comp && TM.comp.buildBestLineup && ps.length >= 11) {
      var lu = TM.comp.buildBestLineup(ps, F[formacao] ? formacao : "auto");
      var porId = {}; ps.forEach(function (p) { porId[p.id] = p; });
      var tit = lu.starters.map(function (id) { return porId[id]; }).filter(Boolean), usado = {};
      tit.forEach(function (p) { usado[p.id] = 1; });
      ps = tit.concat(ps.filter(function (p) { return !usado[p.id]; }));
      formacao = lu.formation; remontada = true;
    }
    if (!F[formacao]) formacao = "4-4-2";
    var vagas = (F[formacao] || []).slice();
    // posição LIVRE arrastada no campinho do TM: a vaga do titular é a dela (TM.comp.fieldSlot)
    if (!remontada && time.posicoes && TM.comp && TM.comp.fieldSlot) {
      for (var i = 0; i < 11; i++) { var cp = time.posicoes[i]; if (cp && isFinite(cp[0]) && isFinite(cp[1])) vagas[i] = TM.comp.fieldSlot(cp[0], cp[1]); }
    }
    return { players: ps, formacao: formacao, vagas: vagas };
  }
  function kit(shirt, sleeves, shorts, socks, pattern, second, trim, number, collar) {
    return { shirt: shirt, sleeves: sleeves, shorts: shorts, socks: socks, pattern: pattern, second: second, trim: trim, number: number,
             collar: collar || "crew", sponsor: "TOTAL MATCH", sponsorColor: number };
  }
  // os mesmos 3 uniformes que o TM desenha (placeholders.js kit): cores, padrão e gola pelo clube
  var PADRAO_TM = ["plain", "stripes", "halves", "sash", "hoops", "plain"];
  function uniformeTM(chave, p1, p2, v) {
    var p, s, semente;
    if (v === 1) { p = p2; s = p1; semente = "away"; }
    else if (v === 2) { p = lum(p1) < 0.28 ? clareia(p2, 26) : escurece(p1, 48); s = lum(p) < 0.32 ? clareia(p2, 22) : escurece(p1, 24); semente = "third"; }
    else { p = p1; s = p2; semente = "home"; }
    var h = hash(chave + semente);
    var calcao = dist(s, p) > 70 ? s : contraste(p);
    return kit(p, s, calcao, p, PADRAO_TM[h % 6], s, s, contraste(p), ((h >>> 4) % 2 === 0) ? "v" : "crew");
  }
  function goleiroLonge(cores, r) {
    var ops = GOLEIRO.filter(function (c) { return cores.every(function (x) { return dist(c, x) > 120; }); });
    return escolhe(ops.length ? ops : GOLEIRO, r);
  }
  /* ---------- identidade do time (v2): a MESMA imagem que o TM mostra ---------- */
  // caminho do site (assets/...) vira endereço absoluto: o 3D roda em outra pasta do mesmo site
  function abs(s) {
    if (!s) return null;
    if (/^(data:|blob:|https?:)/i.test(s)) return s;
    try { return new URL(s, global.location.href).href; } catch (e) { return s; }
  }
  function srcDe(fn, x) { try { var im = fn(x, ""); return (im && im.getAttribute && im.getAttribute("src")) || null; } catch (e) { return null; } }
  function nomeDe(v) { return typeof v === "string" ? v : (v && v.name) || ""; }
  // escudo grande demais (PNG importado em data URL) não cabe no pedido: o 3D desenha a sigla
  var ESCUDO_MAX = 220000;
  function identidade(time, clube, nac, p1, sigla) {
    var I = TM.img || {}, D = TM.data || {}, esc = null, tipo = null, st = null, lg = null, paisN = null, foto = null;
    if (clube && I.clubImg) { esc = srcDe(I.clubImg, clube); tipo = clube.crestData ? "importado" : /^data:/i.test(esc || "") ? "gerado" : "real"; }
    else if (nac && I.nationImg) { esc = srcDe(I.nationImg, nac); tipo = "selecao"; }
    else if (time.escudoUT && TM.ut && TM.ut._i && TM.ut._i.escudoSvg) {
      try { esc = TM.ut._i.escudoSvg(time.escudoUT, time.escudoUT.cor || p1, sigla); tipo = "ultimate"; } catch (e) { esc = null; }
    }
    if (esc && esc.length > ESCUDO_MAX) { esc = null; tipo = null; }
    try { if (clube && D.stadium) st = D.stadium(clube); } catch (e) {}
    try { if (clube && D.league) lg = D.league(clube.homeLeagueId || clube.leagueId); } catch (e) {}
    try { paisN = nac || (lg && lg.nation && D.nationByName ? D.nationByName(lg.nation) : null); } catch (e) {}
    if (clube && I.stadiumImg) foto = srcDe(I.stadiumImg, clube);
    return {
      escudo: abs(esc), escudoTipo: esc ? tipo : null,
      bandeira: paisN && I.flagImg ? abs(srcDe(I.flagImg, paisN)) : null,
      pais: paisN ? (paisN.name || "") : "", liga: lg ? (lg.name || "") : "", tecnico: nomeDe((clube || nac || {}).coach),
      estadio: st && st.name ? { nome: st.name, capacidade: st.capacity || 0, foto: abs(foto) } : null
    };
  }
  // o empate desta partida CONTINUA no TM (prorrogação ou pênaltis)? o.empateContinua do modo: true/false, ou uma função
  // (gols da casa, gols de fora) → o modo iria a prorrogação/pênaltis com esse empate (a ida e volta depende do placar). Com a
  // função: true/false quando todo empate de 0×0 a 6×6 dá a mesma resposta; senão (ou sem o campo) undefined — o 3D usa a
  // versão curta da cena do pós-jogo no empate, que serve nos dois casos (golaco/PLANO-CENAS.md §5.2)
  function empateContinuaDe(v) {
    if (typeof v === "boolean") return v;
    if (typeof v !== "function") return undefined;
    var r = null;
    for (var g = 0; g <= 6; g++) {
      var x;
      try { x = !!v(g, g); } catch (e) { return undefined; }
      if (r === null) r = x; else if (r !== x) return undefined;
    }
    return r;
  }
  // contexto da partida (v2): mando neutro, público (0,1–1) e clássico, pelo simOpts do modo; empateContinua (o empate vai a
  // prorrogação/pênaltis no TM: a cena do pós-jogo curta) só quando o modo sabe
  function partidaDe(o, home, away) {
    var so = o.simOpts || {}, a = o.teamA || {}, b = o.teamB || {}, ca = a.club || null, cb = b.club || null, D = TM.data || {};
    var classico = so.derby != null ? !!so.derby : false;
    try { if (so.derby == null && ca && cb && D.areRivals) classico = !!D.areRivals(ca.id, cb.id); } catch (e) {}
    var nomeCl = null;
    try { if (classico && ca && cb && D.derbyName) nomeCl = D.derbyName(ca.id, cb.id) || null; } catch (e) {}
    var pub = typeof so.crowd === "number" && isFinite(so.crowd) ? Math.max(0.1, Math.min(1, so.crowd)) : 0.75;
    var r = { neutro: !!so.neutral, publico: Math.round(pub * 100) / 100, classico: classico, nomeClassico: nomeCl,
             competicao: o.title || "", estadio: so.neutral ? null : (home.identidade && home.identidade.estadio) || null };
    var ec = empateContinuaDe(o.empateContinua);
    if (ec !== undefined) r.empateContinua = ec;
    return r;
  }
  /* time = time do motor do TM ({ id, name, short?, players, club?, nation?, colors?, kitVariant? }) */
  function time3d(time, formacao) {
    var clube = time.club || null, nac = time.nation || null;
    var base = clube || nac || {};
    var chave = base.id || base.name || time.id || time.name;
    var r = sorteio(hash("time" + chave));
    var cores = time.colors || base.colors || null;      // times do Ultimate trazem a cor do escudo
    var p1 = (cores && cores.primary) || escolhe(["#1e6fd9", "#d62828", "#2a9d5c", "#f5a524", "#6a4c93"], r);
    var p2 = (cores && cores.secondary) || "#ffffff";
    if (dist(p1, p2) < 60) p2 = lum(p1) > 0.5 ? "#111111" : "#ffffff";
    var casa = uniformeTM(chave, p1, p2, 0), fora = uniformeTM(chave, p1, p2, 1), terceiro = uniformeTM(chave, p1, p2, 2);
    var gk1 = goleiroLonge([p1, p2, terceiro.shirt], r), gk2 = goleiroLonge([p1, p2, terceiro.shirt, gk1], r);
    var sigla = (base.short || time.short || String(time.name || "TME").replace(/[^A-Za-zÀ-ú]/g, "").slice(0, 3)).toUpperCase().slice(0, 3);
    var esc = escalacao(time, time.formation || formacao);
    var jogs = esc.players.slice(0, 18).map(function (p, i) { return jogador3d(p, i, i < 11 ? esc.vagas[i] : null); });
    var xi = jogs.slice(0, 11), nota = xi.length ? Math.round(xi.reduce(function (s, p) { return s + p.overall; }, 0) / xi.length) : 70;
    var estadio = null; try { estadio = clube && TM.data.stadium ? TM.data.stadium(clube).name : null; } catch (e) {}
    var id = "tm_" + String(chave || hash(time.name)).replace(/[^a-zA-Z0-9_-]/g, "");
    var kv = time.kitVariant;
    return {
      id: id, name: time.name, short: sigla, city: "", nickname: "", stadium: estadio || ("Arena " + time.name),
      formation: FORM_3D[esc.formacao] || "4-4-2", formacaoTM: esc.formacao,
      rating: nota, style: { press: 0.5, width: 0.5, tempo: 0.5, directness: 0.5 },
      colors: { primary: p1, secondary: p2 }, collar: casa.collar, sponsor: "TOTAL MATCH",
      crest: { shape: escolhe(FORMAS, r), motif: escolhe(MOTIVOS, r), emblem: escolhe(EMBLEMAS, r), metal: r() < 0.5 ? "gold" : "silver",
               stars: 0, initials: sigla, field: p1, motifColor: p2, disc: tom(p1, -0.45), ink: contraste(p1), accent: p2,
               chief: tom(p1, -0.45), chiefText: "#ffffff", ribbon: tom(p1, -0.45), ribbonText: "#ffffff" },
      kits: {
        home: casa, away: fora, third: terceiro,
        gk: kit(gk1, gk1, gk1, gk1, "plain", contraste(gk1), contraste(gk1), contraste(gk1)),
        gkAway: kit(gk2, gk2, gk2, gk2, "plain", contraste(gk2), contraste(gk2), contraste(gk2))
      },
      kitEscolhido: (kv === 0 || kv === 1 || kv === 2) ? kv : null,
      identidade: identidade(time, clube, nac, p1, sigla),
      players: jogs, tm: true
    };
  }

  /* ---------- resultado do 3D → resultado do TM (no mesmo objeto) ---------- */
  function achaJogador(t, g) {
    var ps = (t && t.players) || [];
    for (var i = 0; i < ps.length; i++) if (ps[i].id === g.tmId) return ps[i];
    for (var j = 0; j < ps.length; j++) if (nomeCurto(ps[j].name) === g.nome || ps[j].name === g.nome) return ps[j];
    return null;
  }
  function minuto(m) { return Math.max(1, Math.min(90, Math.round(m || 1))); }
  function aplicaResultado(result, r3, teamA, teamB) {
    var gols = (r3.gols || []).slice().sort(function (a, b) { return (a.minuto || 0) - (b.minuto || 0); });
    var placar = [0, 0], ev = [], expulsos = [];
    gols.forEach(function (g) {
      var lado = g.lado === 1 ? 1 : 0, t = lado === 0 ? teamA : teamB;
      // gol contra: o autor é do outro time e não conta como gol dele
      var pl = g.contra ? null : achaJogador(t, g);
      var autor = g.contra ? achaJogador(lado === 0 ? teamB : teamA, g) : null;
      placar[lado]++;
      var quem = pl ? pl.name : g.contra ? (autor ? autor.name : (g.nome || "Jogador")) + " (contra)" : (g.nome || "Jogador");
      ev.push({ minute: minuto(g.minuto), type: g.penalti ? "pengoal" : "goal", team: lado,
                player: quem, playerId: pl ? pl.id : null, score: placar.slice(),
                text: g.contra ? "GOL CONTRA! " + quem.replace(" (contra)", "") + " desvia para o próprio gol. Ponto para o " + t.name + "."
                  : (g.penalti ? "PÊNALTI CONVERTIDO! " : "GOL! ") + quem + " marca para o " + t.name + "." });
    });
    (r3.cartoes || []).forEach(function (c) {
      var lado = c.lado === 1 ? 1 : 0, t = lado === 0 ? teamA : teamB, pl = achaJogador(t, c);
      var quem = pl ? pl.name : (c.nome || "Jogador"), verm = c.cor === "red";
      ev.push({ minute: minuto(c.minuto), type: verm ? "red" : "yellow", team: lado, player: quem, playerId: pl ? pl.id : null,
                text: (verm ? "Expulso: " : "Amarelo para ") + quem + " (" + t.name + ")" });
      if (verm) expulsos.push({ id: pl ? pl.id : null, name: quem, side: lado, minute: minuto(c.minuto) });
    });
    var h = r3.homeGoals != null ? r3.homeGoals : placar[0], a = r3.awayGoals != null ? r3.awayGoals : placar[1];
    var meio = ev.filter(function (e) { return e.minute <= 45 && (e.type === "goal" || e.type === "pengoal"); });
    var intervalo = [meio.filter(function (e) { return e.team === 0; }).length, meio.filter(function (e) { return e.team === 1; }).length];
    ev.push({ minute: 45, type: "half", score: intervalo, text: "Fim do 1º tempo" });
    ev.sort(function (x, y) { return x.minute - y.minute || (x.type === "half" ? 1 : 0) - (y.type === "half" ? 1 : 0); });
    ev.push({ minute: 90, type: "full", score: [h, a], text: "Fim de jogo! (partida jogada em 3D)" });
    result.score = [h, a];
    result.events = ev;
    var st = r3.stats || {};
    result.stats = {
      possession: st.possession || (result.stats && result.stats.possession) || [50, 50],
      shots: st.shots || [Math.max(h, 1) + 4, Math.max(a, 1) + 4],
      onTarget: st.onTarget || [h + 1, a + 1]
    };
    result.injuries = []; result.sentOff = expulsos;
    result.em3d = true;
    if (result.focus && r3.jogador) {
      result.focus = { goals: r3.jogador.gols || 0, rating: r3.jogador.nota || result.focus.rating, injured: false, assists: r3.jogador.assist || 0 };
    }
    return result;
  }

  /* ---------- quadro do 3D por cima do TM ---------- */
  var ativo = null;
  // pedidos/resultados que sobraram (TM fechado com o 3D aberto, aba solta): só existe um 3D aberto por vez
  function limpaSobras() {
    try {
      var velhas = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && /^tm3d:(pedido|resultado):/.test(k)) velhas.push(k); }
      velhas.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }
  // textos do quadro (o X, a confirmação e o aviso de demora): a partida é simulada quando o 3D não vem; os Pênaltis 3D
  // (jogarPenaltis) não simulam nada — só voltam à escolha dos times (fns.textos)
  var TEXTOS_PARTIDA = { quadro: "Partida em 3D", sair: "Voltar e simular", confirma: "Sair do 3D?",
    confirmaTexto: "A partida é simulada do começo, como sem o 3D.", confirmaBotao: "Simular", demora: "Simular a partida" };
  function abre3d(pedido, fns) {
    if (ativo) fecha3d();
    limpaSobras();
    var T = Object.assign({}, TEXTOS_PARTIDA, fns.textos || {});
    try { localStorage.setItem("tm3d:pedido:" + pedido.id, JSON.stringify(pedido)); } catch (e) { fns.falhou("Sem espaço para preparar a partida 3D."); return; }
    var aviso = el("div", { class: "tm3d-aviso", text: "Abrindo o estádio 3D…" });
    var quadro = el("iframe", { class: "tm3d-quadro", src: api.PASTA + "?tm=" + encodeURIComponent(pedido.id), allow: "fullscreen; autoplay; gamepad", title: T.quadro });
    var sair = el("button", { class: "tm3d-sair", type: "button", title: T.sair, on: { click: function () {
      TM.ui.confirm(T.confirma, T.confirmaTexto, T.confirmaBotao, function () { termina("sair", null, T.sairDados || null); });
    } } }, [TM.ic("x")]);
    var tela = el("div", { class: "tm3d-tela" }, [aviso, quadro, sair]);
    document.body.appendChild(tela);
    document.body.classList.add("tm3d-aberto");
    var pronto = false, acabou = false;
    var espera = setTimeout(function () {
      if (pronto || acabou) return;
      aviso.textContent = "O 3D está demorando para abrir.";
      aviso.appendChild(el("button", { class: "btn small", text: T.demora, on: { click: function () { termina("sair"); } } }));
    }, api.ESPERA_MS);
    function lerResultado() { try { var t = localStorage.getItem("tm3d:resultado:" + pedido.id); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
    function ouvir(e) {
      if (e.origin !== global.location.origin || !e.data || e.data.id !== pedido.id) return;
      if (e.source && quadro.contentWindow && e.source !== quadro.contentWindow) return;
      // com o 3D no ar, o botão de sair é o do próprio 3D (pausa): o X do TM some para não ficar por cima do placar
      if (e.data.tipo === "tm3d:pronto") {
        pronto = true; aviso.style.display = "none"; sair.style.display = "none";
        if (fns.pronto) fns.pronto(quadro.contentWindow, pedido.id);
      }
      // o quadro pede a porta de novo (Online 3D: recarregou ou perdeu a dela)
      else if (e.data.tipo === "tm3d:pedePorta") { if (fns.pronto) fns.pronto(quadro.contentWindow, pedido.id); }
      else if (e.data.tipo === "tm3d:fim") termina("fim", e.data.resultado || lerResultado(), e.data);
      else if (e.data.tipo === "tm3d:sair") termina("sair", null, e.data);
    }
    // dados = a mensagem do 3D (o Online 3D lê dados.abandono e dados.online); os outros modos ignoram
    function termina(como, res, dados) {
      if (acabou) return;
      acabou = true;
      clearTimeout(espera);
      fecha3d();
      try { localStorage.removeItem("tm3d:pedido:" + pedido.id); localStorage.removeItem("tm3d:resultado:" + pedido.id); } catch (e) {}
      if (como === "fim" && res) fns.fim(res, dados || null); else fns.sair(dados || null);
    }
    global.addEventListener("message", ouvir);
    ativo = { tela: tela, ouvir: ouvir };
  }
  function fecha3d() {
    if (!ativo) return;
    global.removeEventListener("message", ativo.ouvir);
    try { ativo.tela.remove(); } catch (e) {}
    document.body.classList.remove("tm3d-aberto");
    ativo = null;
  }

  /* ---------- escolha antes do jogo: Jogar em 3D ou Simular ---------- */
  function escolha(cfg, simular, tres) {
    var sempre = false;
    var ov = el("div", { class: "ut-sheet tm3d-escolha" });
    var caixa = el("label", { class: "tm3d-sempre" }, [
      el("input", { type: "checkbox", on: { change: function (e) { sempre = !!e.target.checked; } } }),
      el("span", { text: "Lembrar minha escolha (dá para mudar em Config)" })
    ]);
    function vai(fn, pref) { return function () { if (sempre) salvaPreferencia(pref); fecha(); fn(); }; }
    var a = cfg.teamA || {}, b = cfg.teamB || {};
    ov.appendChild(el("div", { class: "ut-sheet-in" }, [
      el("div", { class: "ut-sheet-h" }, [el("span", { text: cfg.title || "Partida" }), el("button", { class: "ut-x", text: "✕", on: { click: function () { fecha(); simular(); } } })]),
      el("div", { class: "tm3d-confronto", text: (a.name || "Casa") + " × " + (b.name || "Fora") }),
      el("button", { class: "tm3d-op tres", type: "button", on: { click: vai(tres, "3d") } }, [
        el("span", { class: "tm3d-op-ic" }, [TM.ic("gamepad-2")]),
        el("span", { class: "tm3d-op-i" }, [el("b", { text: "Jogar em 3D" }), el("span", { text: cfg.controle && cfg.controle.tmId ? "Você controla só o seu jogador, no estádio 3D." : "Você controla o seu time, no estádio 3D." })])
      ]),
      el("button", { class: "tm3d-op", type: "button", on: { click: vai(simular, "simular") } }, [
        el("span", { class: "tm3d-op-ic" }, [TM.ic("fast-forward")]),
        el("span", { class: "tm3d-op-i" }, [el("b", { text: "Simular" }), el("span", { text: "Acompanhe lance a lance, como sempre." })])
      ]),
      caixa
    ]));
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("show"); });
    function fecha() { ov.classList.remove("show"); setTimeout(function () { ov.remove(); }, 200); }
  }

  /* ---------- jogar uma partida do TM em 3D ----------
     cfg = o mesmo cfg do TM.matchview.play (teamA, teamB, result, pauseSide, formation,
     formationB, title, controle?). Ao fim, o result vira o do 3D e a tela de jogo do TM
     mostra o placar na hora (velocidade instantânea), seguindo o fluxo normal do modo. */
  // v2 = v1 + identidade de cada time + partida (o motor antigo ignora os campos novos)
  function novoPedido(o) {
    // o cfg.formation do TM é a do time do usuário: jogando fora, ela é a do time B
    var fA = o.formation, fB = o.formationB;
    if (o.userSide === 1 && fB == null) { fB = fA; fA = null; }
    var home = time3d(o.teamA, fA), away = time3d(o.teamB, fB);
    var p = {
      v: 2, id: "j" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      titulo: o.title || "Partida", origem: (TM.ui.current && TM.ui.current()) || "",
      home: home, away: away, partida: partidaDe(o, home, away),
      // edição do TM: na pro (licenciada) o 3D desenha o estádio real do mandante; na pública, o Estádio Total Match
      edicao: (function () { try { return TM.storage.edition() === "pro" ? "pro" : "public"; } catch (e) { return "public"; } })(),
      userSide: o.userSide === 1 ? "away" : "home", controle: o.controle || null
    };
    // Pênaltis 3D: só a disputa (o golaco abre direto nela); sem o campo, a partida de sempre
    if (o.modo === "penaltis") { p.modo = "penaltis"; p.controle = null; }
    // Modo Livre 3D: o treino livre (o golaco abre na escolha de jogadores); a escolha inicial é opcional
    else if (o.modo === "livre") {
      p.modo = "livre"; p.controle = null;
      var lv = livreDe(o.livre, o.userSide === 1 ? 1 : 0);
      if (lv) p.livre = lv;
    }
    return p;
  }
  /* Modo Livre: a escolha inicial de jogadores, conferida (o 3D confere de novo): de linha 0–10 em cada time, o time do
     usuário com ≥ 1 de linha (o humano precisa de alguém para controlar) e o goleiro de cada um ligado ou desligado.
     Sem a escolha (ou sem linha): null — o 3D começa com a última que ele guardou (5 contra 5 na primeira vez). */
  function livreDe(l, humano) {
    if (!l || !l.linha || typeof l.linha.length !== "number") return null;
    var linha = [0, 1].map(function (t) {
      var n = Math.round(Number(l.linha[t]));
      if (!isFinite(n)) n = 4;
      return Math.max(t === humano ? 1 : 0, Math.min(10, n));
    });
    var goleiro = [0, 1].map(function (t) { return !l.goleiro || l.goleiro[t] == null ? true : !!l.goleiro[t]; });
    return { linha: linha, goleiro: goleiro };
  }
  /* partida 3D fora da tela de jogo do TM (ex.: Rumo ao Estrelato, que tem a própria súmula):
     o = { teamA, teamB, formation?, formationB?, userSide: 0|1, controle?: { tmId }, title, simOpts? }
     fns.fim(resultado3d) | fns.sair() (voltou sem jogar: o modo simula como sempre) */
  function jogar3d(o, fns) {
    abre3d(novoPedido(o), { fim: fns.fim, sair: fns.sair,
      falhou: function (msg) { TM.ui.toast(msg || "O 3D não abriu: partida simulada.", "alerta"); fns.sair(); } });
  }
  /* Pênaltis 3D: o = { teamA, teamB, userSide: 0|1, title?, simOpts? }; fns.fim(resultado3d) com resultado3d.penaltis |
     fns.sair() (o 3D não abriu ou o usuário saiu) */
  function jogarPenaltis(o, fns) {
    if (!webgl()) { TM.ui.toast("Este aparelho não tem WebGL 2, que os pênaltis em 3D precisam.", "alerta"); if (fns.sair) fns.sair(); return false; }
    abre3d(novoPedido(Object.assign({}, o, { modo: "penaltis", title: o.title || "Disputa de pênaltis" })), {
      fim: function (r3) { if (r3 && r3.penaltis) fns.fim(r3); else if (fns.sair) fns.sair(); },
      sair: function () { if (fns.sair) fns.sair(); },
      falhou: function (msg) { TM.ui.toast(msg || "O 3D não abriu.", "alerta"); if (fns.sair) fns.sair(); },
      // nada é simulado: sair volta à escolha dos times, sem resultado
      textos: { quadro: "Pênaltis em 3D", sair: "Sair dos pênaltis", confirma: "Sair dos pênaltis 3D?",
        confirmaTexto: "A disputa não conta e você volta à escolha dos times.", confirmaBotao: "Sair", demora: "Voltar" }
    });
    return true;
  }
  /* Modo Livre 3D: o = { teamA, teamB, userSide: 0|1, title?, simOpts?, livre?: { linha: [a, b], goleiro: [g0, g1] } };
     fns.sair() quando o usuário sai do treino (ou o 3D não abre) e fns.fim(resultado3d) com resultado3d.livre (o placar do
     treino, só informativo) — sem fns.fim, o fim também chama fns.sair. Nada é simulado nem registrado. */
  function jogarLivre(o, fns) {
    if (!webgl()) { TM.ui.toast("Este aparelho não tem WebGL 2, que o Modo Livre 3D precisa.", "alerta"); if (fns.sair) fns.sair(); return false; }
    abre3d(novoPedido(Object.assign({}, o, { modo: "livre", title: o.title || "Modo Livre" })), {
      fim: function (r3) { if (fns.fim) fns.fim(r3 || null); else if (fns.sair) fns.sair(); },
      sair: function () { if (fns.sair) fns.sair(); },
      falhou: function (msg) { TM.ui.toast(msg || "O 3D não abriu.", "alerta"); if (fns.sair) fns.sair(); },
      // nada é simulado: sair volta à escolha dos times, sem resultado
      textos: { quadro: "Modo Livre em 3D", sair: "Sair do Modo Livre", confirma: "Sair do Modo Livre 3D?",
        confirmaTexto: "O treino não conta e você volta à escolha dos times.", confirmaBotao: "Sair", demora: "Voltar" }
    });
    return true;
  }
  /* Online 3D (js/online3d.js): o pedido já vem pronto (o anfitrião monta e manda ao convidado; cada aparelho põe o
     próprio id, userSide e online.lado). fns.pronto(janelaDoQuadro, id) a cada 'tm3d:pronto'/'tm3d:pedePorta' (entrega
     a MessagePort); fns.fim(resultado3d, dados) | fns.sair(dados) — dados = a mensagem do 3D (abandono, online);
     o X do quadro antes do 3D ficar pronto também é abandono ({ abandono: true }). */
  function jogarOnline(pedido, fns) {
    if (!webgl()) { TM.ui.toast("Este aparelho não tem WebGL 2, que o Online 3D precisa.", "alerta"); if (fns.sair) fns.sair(null); return false; }
    if (!pedido || pedido.modo !== "online" || !pedido.online || !pedido.home || !pedido.away || !pedido.id) { if (fns.sair) fns.sair(null); return false; }
    abre3d(pedido, {
      pronto: fns.pronto,
      fim: function (r3, dados) { if (fns.fim) fns.fim(r3, dados); },
      sair: function (dados) { if (fns.sair) fns.sair(dados); },
      falhou: function (msg) { TM.ui.toast(msg || "O 3D não abriu.", "alerta"); if (fns.sair) fns.sair(null); },
      textos: { quadro: "Partida online em 3D", sair: "Sair da partida", confirma: "Sair da partida online?",
        confirmaTexto: "Conta como derrota por W.O.", confirmaBotao: "Sair", demora: "Sair", sairDados: { abandono: true } }
    });
    return true;
  }
  function jogarCfg(screen, cfg, playOrig) {
    var pedido = novoPedido({ teamA: cfg.teamA, teamB: cfg.teamB, formation: cfg.formation, formationB: cfg.formationB,
      userSide: cfg.pauseSide === 1 ? 1 : 0, controle: cfg.controle, title: cfg.title, simOpts: cfg.simOpts, empateContinua: cfg.empateContinua });
    abre3d(pedido, {
      fim: function (r3) {
        aplicaResultado(cfg.result, r3, cfg.teamA, cfg.teamB);
        var s2 = Object.assign({}, cfg.settings || TM.storage.settings(), { matchSpeed: "instantaneo" });
        playOrig(screen, Object.assign({}, cfg, { settings: s2, ja3d: true }));
      },
      sair: function () { TM.ui.toast("Partida simulada.", "ok"); playOrig(screen, Object.assign({}, cfg, { ja3d: true })); },
      falhou: function (msg) { TM.ui.toast(msg || "O 3D não abriu: partida simulada.", "alerta"); playOrig(screen, Object.assign({}, cfg, { ja3d: true })); }
    });
  }
  // o 3D entra em toda partida que tem um lado do jogador (pauseSide) e não é online contra outra pessoa
  function ofereceEm(cfg) {
    if (!cfg || cfg.ja3d || cfg.sem3d || cfg.pauseSide == null || !cfg.teamA || !cfg.teamB || !cfg.result) return false;
    if (cfg.result.penaltyOnly) return false;
    return webgl();
  }

  if (TM.matchview && TM.matchview.play) {
    var playOrig = TM.matchview.play;
    TM.matchview.play = function (screen, cfg) {
      if (!ofereceEm(cfg)) return playOrig(screen, cfg);
      var pref = preferencia();
      if (pref === "simular") return playOrig(screen, cfg);
      if (pref === "3d") return jogarCfg(screen, cfg, playOrig);
      // a escolha aparece por cima da tela atual; a tela de jogo só é montada depois
      escolha(cfg, function () { playOrig(screen, cfg); }, function () { jogarCfg(screen, cfg, playOrig); });
    };
  }

  api.disponivel = webgl;
  api.preferencia = preferencia;
  api.salvaPreferencia = salvaPreferencia;
  api.time3d = time3d;
  api.novoPedido = novoPedido;
  api.aplicaResultado = aplicaResultado;
  api.empateContinuaDe = empateContinuaDe;
  api.jogarCfg = jogarCfg;
  api.jogar3d = jogar3d;
  api.jogarPenaltis = jogarPenaltis;
  api.jogarLivre = jogarLivre;
  api.jogarOnline = jogarOnline;
  api.escolha = escolha;
  api.fechar = fecha3d;
  TM.tm3d = api;
})(window);
