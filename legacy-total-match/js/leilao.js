/* ================= TOTAL MATCH — Modo Leilão: o núcleo PURO ================= */
/* Plano: PLANO-LEILAO.md (§1.2 os lotes, §1.3 o lote e o lance, §1.5 a formação, §3.2 o `vivo`, §3.3 o protocolo,
   §3.5 os robôs). Sem DOM e sem rede: as MESMAS funções rodam no treino (rede em memória), dentro das transações do
   Firebase (PR 2) e nos testes em Node (ferramentas/testar-leilao.mjs). Toda hora é passada como argumento (`agora`,
   em ms, a do servidor); nada aqui lê relógio nem Math.random (o sorteio é o TM.rng com a semente da sala).

   O `vivo` (o estado do leilão; §3.2):
     { seq, fase: 'lotes'|'rep'|'fim', k, i, abre, n, lider, valor, t, h, p, d, sem, cx, f }
     seq   sobe a cada lote aberto (também na repescagem do mesmo lote) e no fim
     k, i  a posição na fila da fase (ctx.fila nos lotes, `sem` na repescagem) e o índice do lote em ctx.lotes
     abre  a hora em que o lote abriu (o "Vendido para…" fica ESPERA ms com os botões desligados)
     n     lances neste lote; lider (-1 = ninguém), valor (0 = sem lance), t a hora do último lance (0 = nenhum)
     h     os últimos 5 lances [[técnico, valor], …]
     p     quem passou neste lote ("00100000")
     d     o comprador de cada lote ("ab-c…": 'a' é o técnico 0; '-' sem dono) — a VERDADE das compras
     sem   os lotes que ficaram sem lance (a fila da repescagem)
     cx    [[saldo, vagas, gk, df, mf, fw] × T] (as contagens pela posição principal)
     f     no fim: o técnico de cada jogador de `fora` que completou um time de graça ("--a-b…")
   O Firebase não guarda objeto nem lista vazia: toda função aceita a falta de p, h, sem e f (e de lider/valor/n/t).
   Lance com menos de `ext` faltando devolve o relógio a `ext`: fim = max(abre + ESPERA + dur, t + ext). */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  /* ---------- constantes ---------- */
  var REGRAS = 1;                 // versão das regras: só muda quando a regra muda (quem tem outra versão só olha)
  var SALDO = 100;                // R$ do jogo para cada técnico
  var VAGAS = 11;                 // o time: 11 em campo, sem reservas
  var LOTES_POR_TEC = 13;
  var TEC_MIN = 2, TEC_MAX = 8;
  var DUR = 10000;                // relógio do lote (ms); a sala pode escolher 10/15/20 s
  var EXT = 8000;                 // lance com menos de 8 s faltando: volta a 8 s
  var ESPERA = 1500;              // pausa entre lotes ("Vendido para X por R$ Y", botões desligados)
  var DUR_REP = 6000;             // repescagem: 6 s por lote
  var TOQUE_MAX = 2000;           // o lance tem de chegar até 2 s depois do toque (lance velho guardado é recusado)
  var TEMPOS = [10000, 15000, 20000];
  var GRUPOS = ["GK", "DF", "MF", "FW"];
  var BIT = { GK: 1, DF: 2, MF: 4, FW: 8 };
  var IDX = { GK: 0, DF: 1, MF: 2, FW: 3 };
  var LETRAS = "abcdefgh";
  // as 6 formações (TM.comp.FORMATIONS; o testar-leilao L9 confere): vagas [GK, DF, MF, FW]
  var FORMACOES = ["4-4-2", "4-3-3", "3-5-2", "3-4-3", "5-4-1", "4-2-4"];
  var VAGAS_FORM = {
    "4-4-2": [1, 4, 4, 2], "4-3-3": [1, 4, 3, 3], "3-5-2": [1, 3, 5, 2],
    "3-4-3": [1, 3, 4, 3], "5-4-1": [1, 5, 4, 1], "4-2-4": [1, 4, 2, 4]
  };
  // o time-alvo de cada técnico na conta do mercado dos robôs (as cotas por técnico, arredondadas: 1, 4, 4, 2)
  var ALVO = [1, 4, 4, 2];
  // jogadores de FORA guardados para completar no fim, por técnico (o máximo de cada grupo numa formação)
  var FORA_POR_TEC = { GK: 1, DF: 5, MF: 5, FW: 4 };
  var PERFIS = ["estrelas", "equilibrado", "paciente"];
  var TETO_PERFIL = { estrelas: 0.6, equilibrado: 0.35, paciente: 0.45 };

  // submáscaras não vazias de cada conjunto de grupos (o teste de Hall do emparelhamento)
  var SUB = [];
  for (var S = 0; S < 16; S++) { SUB[S] = []; for (var m = 1; m < 16; m++) if ((m & ~S) === 0) SUB[S].push(m); }

  function rngDe(semente) {
    var partes = Array.prototype.slice.call(arguments, 1).join(":");
    return TM.rng.make(TM.rng.hashStr("leilao:" + semente + ":" + partes));
  }
  // o sorteio rápido dos robôs (milhares por leilão): o hash do texto uma vez por semente e os números misturados
  // por conta inteira (Math.imul: a mesma em todo aparelho)
  var _hBase = { s: null, h: {} };
  function hashBase(semente, nome) {
    if (_hBase.s !== semente) { _hBase.s = semente; _hBase.h = {}; }
    var h = _hBase.h[nome];
    return h != null ? h : (_hBase.h[nome] = TM.rng.hashStr("leilao:" + semente + ":" + nome));
  }
  function mistura(h, x) {
    h = Math.imul(h ^ (x | 0), 0x9E3779B1); h ^= h >>> 15;
    h = Math.imul(h, 0x85EBCA77); h ^= h >>> 13;
    return h >>> 0;
  }
  function rngRapido(semente, nome, a, b, c) { return TM.rng.make(mistura(mistura(mistura(hashBase(semente, nome), a), b), c)); }
  function letra(t) { return LETRAS.charAt(t); }
  function idxLetra(c) { return LETRAS.indexOf(c); }
  function repete(c, n) { var s = ""; for (var i = 0; i < n; i++) s += c; return s; }
  function cmpId(a, b) { return (String(a).length - String(b).length) || (a < b ? -1 : a > b ? 1 : 0); }
  function cmpNota(a, b) { return (b.overall - a.overall) || cmpId(a.id, b.id); }

  /* ---------- cotas e lotes (§1.2) ---------- */
  // GK ⌈1,5T⌉, FW ⌈2,5T⌉, DF e MF dividem o resto (a sobra ímpar no DF): 13T lotes
  function cotas(T) {
    var gk = Math.ceil(1.5 * T), fw = Math.ceil(2.5 * T), resto = LOTES_POR_TEC * T - gk - fw;
    return { GK: gk, DF: Math.ceil(resto / 2), MF: Math.floor(resto / 2), FW: fw };
  }
  function grupoDoJogador(p, versa) {
    var g = [p.pos];
    (versa ? versa(p) : []).forEach(function (x) { if (BIT[x] && g.indexOf(x) < 0) g.push(x); });
    return g;
  }
  // o retrato do lote: gravado uma vez; ninguém lê o jogador no TM.data para calcular nada
  function retrato(p, versa) {
    var a = {}; Object.keys(p.attrs || {}).forEach(function (k) { a[k] = p.attrs[k]; });
    return {
      id: p.id, name: p.name, pos: p.pos, pos2: p.pos2 || null, grupos: grupoDoJogador(p, versa),
      overall: p.overall, attrs: a, nationId: p.nationId || null, clubId: p.clubId || null,
      homeClubId: p.homeClubId || p.clubId || null, number: p.number || 0, height: p.height || 0, weight: p.weight || 0
    };
  }
  // jogadores da liga no mundo-base: sem clube criado, sem o Viverde, sem nada `especial`
  function jogadoresDaLiga(mundo, ligaId) {
    var lg = mundo && mundo.leaguesById && mundo.leaguesById[ligaId];
    if (!lg) return [];
    var out = [];
    lg.clubIds.forEach(function (cid) {
      var c = mundo.clubsById[cid];
      if (!c || c.custom || c.viverde || c.especial || cid === "viverde") return;
      (c.playerIds || []).forEach(function (pid) {
        var p = mundo.playersById[pid];
        if (!p || p.especial || !BIT[p.pos]) return;
        out.push(p);
      });
    });
    return out.sort(cmpNota);
  }
  /** Os lotes da liga para T técnicos: { lotes: [retrato × 13T], fora: [retrato] } (os melhores de cada grupo pela
   *  cota; `fora` = os melhores que sobraram, para completar de graça no fim). `opc.versa` = TM.comp.playerVersa. */
  function criarLotes(mundo, ligaId, T, opc) {
    opc = opc || {};
    var versa = opc.versa || (TM.comp && TM.comp.playerVersa) || null;
    var todos = jogadoresDaLiga(mundo, ligaId), q = cotas(T), usados = {}, lotes = [], falta = 0;
    GRUPOS.forEach(function (g) {
      var n = 0;
      todos.forEach(function (p) { if (n < q[g] && p.pos === g) { usados[p.id] = 1; lotes.push(p); n++; } });
      falta += q[g] - n;
    });
    // liga sem gente de algum grupo (não acontece nas 30 ligas: testar-leilao L1): completa com os melhores restantes
    todos.forEach(function (p) { if (falta > 0 && !usados[p.id]) { usados[p.id] = 1; lotes.push(p); falta--; } });
    var fora = [], nf = { GK: 0, DF: 0, MF: 0, FW: 0 };
    todos.forEach(function (p) { if (!usados[p.id] && nf[p.pos] < FORA_POR_TEC[p.pos] * T) { nf[p.pos]++; fora.push(p); } });
    lotes.sort(cmpNota);
    return { lotes: lotes.map(function (p) { return retrato(p, versa); }), fora: fora.map(function (p) { return retrato(p, versa); }) };
  }

  /* ---------- a ordem dos lotes (§1.2) ---------- */
  // sorteio pela semente em blocos de T: os grupos espalhados na proporção (cada um em passos iguais com um sorteio
  // dentro do passo), as faixas de nota de cada grupo alternadas (alto, médio, baixo em ordem sorteada a cada volta);
  // o 1º goleiro nos primeiros 20% e nenhum goleiro no último bloco
  function ordem(lotes, semente, T) {
    var r = rngDe(semente, "ordem"), L = lotes.length, chaves = [];
    function embaralha(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
    GRUPOS.forEach(function (g, gi) {
      var lista = [];
      lotes.forEach(function (l, i) { if (l.pos === g) lista.push(i); });
      lista.sort(function (a, b) { return cmpNota(lotes[a], lotes[b]); });
      var n = lista.length; if (!n) return;
      var nb = Math.min(3, n), faixas = [];
      for (var b = 0; b < nb; b++) faixas.push(embaralha(lista.slice(Math.floor(b * n / nb), Math.floor((b + 1) * n / nb))));
      var seq = [];
      while (seq.length < n) embaralha(faixas.map(function (_, i) { return i; })).forEach(function (b) { if (faixas[b].length) seq.push(faixas[b].shift()); });
      seq.forEach(function (li, j) { chaves.push({ li: li, k: (j + r()) / n, g: gi }); });
    });
    chaves.sort(function (a, b) { return (a.k - b.k) || (a.g - b.g) || (a.li - b.li); });
    var fila = chaves.map(function (c) { return c.li; });
    function gk(pos) { return lotes[fila[pos]].pos === "GK"; }
    function troca(a, b) { var x = fila[a]; fila[a] = fila[b]; fila[b] = x; }
    var lim = Math.max(1, Math.floor(0.2 * L)), f = -1;
    for (var i = 0; i < L; i++) if (gk(i)) { f = i; break; }
    if (f >= lim) troca(f, Math.floor(r() * lim));
    var ult = L - T;
    for (var q = ult; q < L; q++) {
      if (!gk(q)) continue;
      for (var w = ult - 1; w >= 0; w--) if (!gk(w)) { troca(q, w); break; }
    }
    return fila;
  }

  /* ---------- o contexto (o que não muda durante o leilão) ---------- */
  /** ctx a partir dos lotes gravados: { T, lotes, fora, semente, tempo (ms do relógio do lote) } */
  function contexto(o) {
    var T = o.T, lotes = o.lotes || [], fora = o.fora || [];
    var dur = TEMPOS.indexOf(o.tempo) >= 0 ? o.tempo : DUR;
    function mascara(l) { var m = 0; (l.grupos || [l.pos]).forEach(function (g) { m |= BIT[g] || 0; }); return m || BIT[l.pos]; }
    var ovs = lotes.map(function (l) { return l.overall; }).sort(function (a, b) { return a - b; });
    var ctx = {
      T: T, lotes: lotes, fora: fora, semente: String(o.semente), L: lotes.length,
      fila: o.fila || ordem(lotes, String(o.semente), T),
      dur: dur, ext: Math.min(EXT, dur), durRep: DUR_REP, extRep: Math.min(EXT, DUR_REP), espera: ESPERA,
      mL: lotes.map(mascara), gL: lotes.map(function (l) { return IDX[l.pos]; }),
      mF: fora.map(mascara), gF: fora.map(function (l) { return IDX[l.pos]; }),
      p80: ovs.length ? ovs[Math.min(ovs.length - 1, Math.floor(0.8 * ovs.length))] : 0,
      rank: null,
      _tm: null, _mk: null
    };
    // a posição de cada lote na ordem por nota (desempate pelo id): ordena o mercado sem comparar ids
    var ord = lotes.map(function (_, i) { return i; }).sort(function (a, b) { return cmpNota(lotes[a], lotes[b]); });
    ctx.rank = []; ord.forEach(function (li, r) { ctx.rank[li] = r; });
    return ctx;
  }

  /* ---------- o vivo: leitura tolerante e cópia ---------- */
  function norm(v, ctx) {
    var T = ctx.T;
    return {
      seq: v.seq || 0, fase: v.fase || "lotes", k: v.k == null ? -1 : v.k, i: v.i == null ? -1 : v.i, abre: v.abre || 0,
      n: v.n || 0, lider: v.lider == null ? -1 : v.lider, valor: v.valor || 0, t: v.t || 0,
      h: (v.h || []).map(function (x) { return [x[0], x[1]]; }),
      p: (v.p && v.p.length === T) ? v.p : repete("0", T),
      d: v.d || repete("-", ctx.L),
      sem: (v.sem || []).slice(),
      cx: (v.cx || []).map(function (c) { return c.slice(); }),
      f: v.f || null
    };
  }
  // para gravar: sem campos vazios (o Firebase não guarda; a memória também não)
  function limpo(v) {
    var o = {};
    Object.keys(v).forEach(function (k) {
      var x = v[k];
      if (x == null) return;
      if (Array.isArray(x) && !x.length) return;
      o[k] = x;
    });
    return o;
  }

  /* ---------- o time de cada técnico ---------- */
  // contagem das máscaras de grupos do time de cada técnico (lotes comprados + os de fora no fim)
  function times(v, ctx) {
    var d = v.d || "", f = v.f || "", c = ctx._tm;
    if (c && c.d === d && c.f === f) return c.r;
    var r = (function () {
      var out = [];
      for (var t = 0; t < ctx.T; t++) out.push({ cnt: new Array(16).fill(0), n: 0, lotes: [], fora: [] });
      for (var i = 0; i < d.length; i++) { var t1 = idxLetra(d.charAt(i)); if (t1 >= 0 && out[t1]) { out[t1].cnt[ctx.mL[i]]++; out[t1].n++; out[t1].lotes.push(i); } }
      for (var j = 0; j < f.length; j++) { var t2 = idxLetra(f.charAt(j)); if (t2 >= 0 && out[t2]) { out[t2].cnt[ctx.mF[j]]++; out[t2].n++; out[t2].fora.push(j); } }
      return out;
    })();
    ctx._tm = { d: d, f: f, r: r };
    return r;
  }
  function hall(cnt, c) {
    for (var S = 1; S < 16; S++) {
      var cap = (S & 1 ? c[0] : 0) + (S & 2 ? c[1] : 0) + (S & 4 ? c[2] : 0) + (S & 8 ? c[3] : 0), tot = 0, sub = SUB[S];
      for (var x = 0; x < sub.length; x++) tot += cnt[sub[x]];
      if (tot > cap) return false;
    }
    return true;
  }
  function comMais(cnt, mask) { var c = cnt.slice(); if (mask) c[mask]++; return c; }
  /** O time (contagem por máscara) encaixa na formação: cada jogador numa vaga de um dos SEUS grupos. */
  function cabeEm(cnt, formacao) { var c = VAGAS_FORM[formacao]; return !!c && hall(cnt, c); }
  function formacoesQueCabem(cnt) { return FORMACOES.filter(function (f) { return hall(cnt, VAGAS_FORM[f]); }); }
  function cabeAlguma(cnt) { for (var i = 0; i < FORMACOES.length; i++) if (hall(cnt, VAGAS_FORM[FORMACOES[i]])) return true; return false; }
  function contaMascaras(retratos) {
    var cnt = new Array(16).fill(0);
    (retratos || []).forEach(function (l) { var m = 0; (l.grupos || [l.pos]).forEach(function (g) { m |= BIT[g] || 0; }); cnt[m || BIT[l.pos]]++; });
    return cnt;
  }
  /** A formação preferida se o time cabe nela; senão a que cabe e mais se parece (soma das diferenças de vagas). */
  function formacaoPara(pref, retratosOuCnt) {
    var cnt = Array.isArray(retratosOuCnt) && retratosOuCnt.length === 16 && typeof retratosOuCnt[0] === "number" ? retratosOuCnt : contaMascaras(retratosOuCnt);
    if (VAGAS_FORM[pref] && hall(cnt, VAGAS_FORM[pref])) return pref;
    var base = VAGAS_FORM[pref] || VAGAS_FORM["4-4-2"], melhor = null, dist = 1e9;
    FORMACOES.forEach(function (f) {
      if (!hall(cnt, VAGAS_FORM[f])) return;
      var c = VAGAS_FORM[f], dd = 0; for (var g = 0; g < 4; g++) dd += Math.abs(c[g] - base[g]);
      if (dd < dist) { dist = dd; melhor = f; }
    });
    return melhor;
  }
  /** Um encaixe de verdade (para a escalação): o grupo (0–3) de cada jogador na formação, ou null se não cabe. */
  function encaixe(retratos, formacao) {
    var c = VAGAS_FORM[formacao]; if (!c) return null;
    var ms = retratos.map(function (l) { var m = 0; (l.grupos || [l.pos]).forEach(function (g) { m |= BIT[g] || 0; }); return m || BIT[l.pos]; });
    var em = [[], [], [], []], de = ms.map(function () { return -1; });
    function tenta(p, vis) {
      for (var g = 0; g < 4; g++) {
        if (!(ms[p] & (1 << g)) || vis[g]) continue;
        vis[g] = 1;
        if (em[g].length < c[g]) { em[g].push(p); de[p] = g; return true; }
        for (var x = 0; x < em[g].length; x++) {
          var q = em[g][x];
          if (tenta(q, vis)) { em[g][x] = p; de[p] = g; return true; }
        }
      }
      return false;
    }
    for (var p = 0; p < ms.length; p++) {
      if (!tenta(p, [0, 0, 0, 0])) return null;
    }
    // o `tenta` de q remove q do grupo antigo só pelo em[g][x] = p; refaz `de` a partir de `em`
    em.forEach(function (lista, g) { lista.forEach(function (q) { de[q] = g; }); });
    return de;
  }

  /* ---------- a escalação (§2.5): os 11 nas vagas da formação ---------- */
  // índices globais (os de escal/{t}.tit): i < L = o lote i; L + j = o j-ésimo de `fora` (completou de graça)
  function timeIdx(v0, ctx, t) {
    var v = norm(v0, ctx), tm = times(v, ctx)[t];
    if (!tm) return [];
    return tm.lotes.concat(tm.fora.map(function (j) { return ctx.L + j; }));
  }
  function retratoDe(ctx, idx) { return idx < ctx.L ? ctx.lotes[idx] : ctx.fora[idx - ctx.L]; }
  // as vagas da formação com as coordenadas do campinho (as do TM: TM.comp.FORMATIONS)
  function slotsDe(formacao) { return (VAGAS_FORM[formacao] && TM.comp && TM.comp.FORMATIONS && TM.comp.FORMATIONS[formacao]) || null; }
  var FORA_VAGA = 1000;   // a vaga não aceita nenhum dos grupos do jogador
  // o custo do jogador na vaga: fora dos SEUS grupos não entra; dentro, a função (pos2) custa −1/−2 (specificPenalty)
  function custoVaga(l, slot) {
    if ((l.grupos || [l.pos]).indexOf(slot[0]) < 0) return FORA_VAGA;
    if (!TM.comp || !TM.comp.specificPenalty) return 0;
    // o retrato com os grupos gravados (o playerVersa lê o _versa): nada é recalculado nem escrito no retrato
    var p = { id: l.id, pos: l.pos, pos2: l.pos2 || null, overall: l.overall, _versa: (l.grupos || [l.pos]).slice(1) };
    return TM.comp.specificPenalty(p, slot) || 0;
  }
  // o emparelhamento de menor custo (método húngaro, n linhas ≤ m colunas, custos inteiros): a coluna de cada linha
  function hungaro(a, n, m) {
    var INF = 1e15, u = [], w = [], p = [], way = [], j;
    for (j = 0; j <= Math.max(n, m); j++) { u[j] = 0; w[j] = 0; p[j] = 0; way[j] = 0; }
    for (var i = 1; i <= n; i++) {
      p[0] = i;
      var j0 = 0, minv = [], usado = [];
      for (j = 0; j <= m; j++) { minv[j] = INF; usado[j] = false; }
      do {
        usado[j0] = true;
        var i0 = p[j0], delta = INF, j1 = 0;
        for (j = 1; j <= m; j++) {
          if (usado[j]) continue;
          var cur = a[i0 - 1][j - 1] - u[i0] - w[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (j = 0; j <= m; j++) { if (usado[j]) { u[p[j]] += delta; w[j] -= delta; } else minv[j] -= delta; }
        j0 = j1;
      } while (p[j0] !== 0);
      do { var j2 = way[j0]; p[j0] = p[j2]; j0 = j2; } while (j0);
    }
    var col = []; for (var k = 0; k < n; k++) col.push(-1);
    for (j = 1; j <= m; j++) if (p[j]) col[p[j] - 1] = j - 1;
    return col;
  }
  /** Os jogadores (retratos, até 11) nas vagas da formação com o menor custo de função: { formacao, tit (o índice do
   *  jogador em cada vaga, -1 = vaga vazia), pen (o −1/−2 de cada vaga) } ou null se não cabem. */
  function escalacao(retratos, formacao) {
    var slots = slotsDe(formacao);
    if (!slots || retratos.length > slots.length) return null;
    var n = retratos.length, a = retratos.map(function (l) { return slots.map(function (s) { return custoVaga(l, s); }); });
    var col = n ? hungaro(a, n, slots.length) : [];
    var tit = slots.map(function () { return -1; }), pen = slots.map(function () { return 0; });
    for (var i = 0; i < n; i++) {
      if (col[i] < 0 || a[i][col[i]] >= FORA_VAGA) return null;
      tit[col[i]] = i; pen[col[i]] = a[i][col[i]];
    }
    return { formacao: formacao, tit: tit, pen: pen };
  }
  // a escalação gravada à mão (escal/{t}.tit, índices globais) ainda vale: os mesmos 11, cada um numa vaga dos seus grupos
  function manualValida(tit, idx, formacao, ctx) {
    var slots = slotsDe(formacao);
    if (!slots || !Array.isArray(tit) || tit.length !== slots.length || idx.length !== slots.length) return null;
    var visto = {}, pen = [];
    for (var s = 0; s < tit.length; s++) {
      var k = tit[s];
      if (typeof k !== "number" || idx.indexOf(k) < 0 || visto[k]) return null;
      visto[k] = 1;
      var c = custoVaga(retratoDe(ctx, k), slots[s]);
      if (c >= FORA_VAGA) return null;
      pen.push(c);
    }
    return pen;
  }
  /** A escalação do técnico t: a gravada (escal/{t}: { formacao, tit }) se ainda vale; senão a automática (função pura
   *  das compras: ninguém precisa gravar). A formação é a preferida se o time cabe nela; senão a que cabe e mais se
   *  parece (aviso). { formacao, pref, aviso, tit (índice global em cada vaga, -1 = vazia), pen, manual, n }. */
  function escalacaoDe(v0, ctx, t, escal, prefPadrao) {
    var v = norm(v0, ctx), idx = timeIdx(v, ctx, t), rs = idx.map(function (k) { return retratoDe(ctx, k); });
    var pref = (escal && VAGAS_FORM[escal.formacao]) ? escal.formacao : (VAGAS_FORM[prefPadrao] ? prefPadrao : "4-4-2");
    var f = formacaoPara(pref, rs) || pref;
    var penM = escal && escal.formacao === f ? manualValida(escal.tit, idx, f, ctx) : null;
    if (penM) return { formacao: f, pref: pref, aviso: f !== pref, tit: escal.tit.slice(), pen: penM, manual: true, n: idx.length };
    var e = escalacao(rs, f);
    var tit = e ? e.tit.map(function (i) { return i < 0 ? -1 : idx[i]; }) : [];
    return { formacao: f, pref: pref, aviso: f !== pref, tit: tit, pen: e ? e.pen : [], manual: false, n: idx.length };
  }
  /** Troca duas vagas (a escalação com os 11): a nova lista `tit` ou { erro } (incompleto, vaga, grupo). */
  function trocarVagas(esc, ctx, a, b) {
    var slots = slotsDe(esc.formacao);
    if (!slots || esc.n !== slots.length) return { erro: "incompleto" };
    if (!(a >= 0 && a < slots.length && b >= 0 && b < slots.length) || a === b) return { erro: "vaga" };
    var tit = esc.tit.slice(), x = tit[a]; tit[a] = tit[b]; tit[b] = x;
    if (custoVaga(retratoDe(ctx, tit[a]), slots[a]) >= FORA_VAGA || custoVaga(retratoDe(ctx, tit[b]), slots[b]) >= FORA_VAGA) return { erro: "grupo" };
    return { tit: tit };
  }

  /* ---------- o lote: quem pode ---------- */
  function vagas(v, t) { var c = v.cx[t]; return c ? c[1] : 0; }
  function maximo(v, t) { var c = v.cx[t]; return c && c[1] > 0 ? c[0] - (c[1] - 1) : 0; }
  function cabeLote(v, ctx, t, i) { return cabeAlguma(comMais(times(v, ctx)[t].cnt, ctx.mL[i])); }
  // pode comprar o lote i de algum jeito (vaga, R$ 1 livre e cabe) — o que decide pular o lote
  function podeComprar(v, ctx, t, i) { return vagas(v, t) > 0 && maximo(v, t) >= 1 && cabeLote(v, ctx, t, i); }
  function alguemPode(v, ctx, i) { for (var t = 0; t < ctx.T; t++) if (podeComprar(v, ctx, t, i)) return true; return false; }
  // pode cobrir o valor atual neste lote (sem contar o "passou"): quem não pode conta como "passou"
  function podeCobrir(v, ctx, t) { return t !== v.lider && vagas(v, t) > 0 && maximo(v, t) >= v.valor + 1 && cabeLote(v, ctx, t, v.i); }
  function todosPassaram(v, ctx) {
    for (var t = 0; t < ctx.T; t++) {
      if (t === v.lider || v.p.charAt(t) === "1") continue;
      if (podeCobrir(v, ctx, t)) return false;
    }
    return true;
  }
  function durFase(v, ctx) { return v.fase === "rep" ? ctx.durRep : ctx.dur; }
  function extFase(v, ctx) { return v.fase === "rep" ? ctx.extRep : ctx.ext; }
  /** A hora em que o lote fecha (derivada; ninguém grava): max(abre + espera + dur, t + ext). */
  function fimDoLote(v0, ctx) {
    var v = norm(v0, ctx);
    return Math.max(v.abre + ctx.espera + durFase(v, ctx), v.n > 0 ? v.t + extFase(v, ctx) : 0);
  }
  /** O que a tela precisa para os botões: { pode, motivo, max, min }. Motivos: fim, completo, lider, passou, goleiro,
   *  posicao (sem vaga que sirva), max (acima do seu máximo), pausa (o lote ainda não abriu), tarde (fechando). */
  function pode(v0, ctx, t, agora) {
    var v = norm(v0, ctx), max = maximo(v, t), r = { pode: false, motivo: null, max: max, min: v.valor + 1 };
    if (v.fase === "fim" || v.i < 0) { r.motivo = "fim"; return r; }
    if (vagas(v, t) <= 0) { r.motivo = "completo"; return r; }
    if (v.lider === t) { r.motivo = "lider"; return r; }
    if (v.p.charAt(t) === "1") { r.motivo = "passou"; return r; }
    if (!cabeLote(v, ctx, t, v.i)) {
      r.motivo = (ctx.lotes[v.i].pos === "GK" && v.cx[t][2] > 0) ? "goleiro" : "posicao"; return r;
    }
    if (max < v.valor + 1) { r.motivo = "max"; return r; }
    if (agora != null) {
      if (agora < v.abre + ctx.espera) { r.motivo = "pausa"; return r; }
      if (agora >= fimDoLote(v, ctx)) { r.motivo = "tarde"; return r; }
    }
    r.pode = true; return r;
  }

  /* ---------- a máquina do lote ---------- */
  function abrir(v, ctx, k, i, agora, carimbo) {
    v.seq++; v.k = k; v.i = i; v.abre = carimbo != null ? carimbo : agora;
    v.n = 0; v.lider = -1; v.valor = 0; v.t = 0; v.h = []; v.p = repete("0", ctx.T);
    return v;
  }
  function comprar(v, ctx, t, i, preco) {
    v.d = v.d.slice(0, i) + letra(t) + v.d.slice(i + 1);
    var c = v.cx[t]; c[0] -= preco; c[1] -= 1; c[2 + ctx.gL[i]]++;
  }
  // quem ainda tem vaga completa de graça com os melhores de FORA que cabem, um por vez: quem tem menos jogadores,
  // depois o técnico de menor índice
  function completar(v, ctx) {
    var f = repete("-", ctx.fora.length).split(""), tm = times(v, ctx), cnt = [], n = [], travado = [];
    for (var t = 0; t < ctx.T; t++) { cnt.push(tm[t].cnt.slice()); n.push(tm[t].n); travado.push(false); }
    for (;;) {
      var alvo = -1;
      for (var u = 0; u < ctx.T; u++) {
        if (v.cx[u][1] <= 0 || travado[u]) continue;
        if (alvo < 0 || n[u] < n[alvo]) alvo = u;
      }
      if (alvo < 0) break;
      var achou = -1;
      for (var j = 0; j < ctx.fora.length; j++) {
        if (f[j] === "-" && cabeAlguma(comMais(cnt[alvo], ctx.mF[j]))) { achou = j; break; }
      }
      if (achou < 0) { travado[alvo] = true; continue; }   // não acontece com a reserva de `fora` (testar-leilao L6)
      f[achou] = letra(alvo); cnt[alvo][ctx.mF[achou]]++; n[alvo]++;
      var c = v.cx[alvo]; c[1] -= 1; c[2 + ctx.gF[achou]]++;
    }
    v.f = f.join("");
  }
  function encerrar(v, ctx) {
    v.seq++; v.fase = "fim"; v.k = -1; v.i = -1;
    v.n = 0; v.lider = -1; v.valor = 0; v.t = 0; v.h = []; v.p = repete("0", ctx.T);
    completar(v, ctx);
    return v;
  }
  // o próximo lote que alguém pode comprar (pula os outros na hora); sem lotes, a repescagem; depois o fim
  function abrirProximo(v, ctx, agora, carimbo) {
    for (var volta = 0; volta < 3; volta++) {
      if (v.fase === "lotes") {
        var k = v.k + 1;
        while (k < ctx.fila.length && (v.d.charAt(ctx.fila[k]) !== "-" || !alguemPode(v, ctx, ctx.fila[k]))) k++;
        if (k < ctx.fila.length) return abrir(v, ctx, k, ctx.fila[k], agora, carimbo);
        v.fase = "rep"; v.k = -1;
        continue;
      }
      if (v.fase === "rep") {
        var k2 = v.k + 1;
        while (k2 < v.sem.length && (v.d.charAt(v.sem[k2]) !== "-" || !alguemPode(v, ctx, v.sem[k2]))) k2++;
        if (k2 < v.sem.length) return abrir(v, ctx, k2, v.sem[k2], agora, carimbo);
        return encerrar(v, ctx);
      }
      return v;
    }
    return v;
  }
  /** O vivo inicial (transação de null): o 1º lote que alguém pode comprar. */
  function inicial(ctx, agora, opc) {
    var v = { seq: 0, fase: "lotes", k: -1, i: -1, abre: 0, n: 0, lider: -1, valor: 0, t: 0, h: [], p: repete("0", ctx.T),
      d: repete("-", ctx.L), sem: [], cx: [], f: null };
    for (var t = 0; t < ctx.T; t++) v.cx.push([SALDO, VAGAS, 0, 0, 0, 0]);
    return limpo(abrirProximo(v, ctx, agora, opc && opc.carimbo));
  }
  // fecha o lote atual SEM conferir a hora: vendido (caixa e dono) ou sem lance (repescagem; na repescagem, sai)
  function fecharJa(v0, ctx, agora, carimbo) {
    var v = norm(v0, ctx);
    if (v.fase === "fim") return v;
    if (v.i >= 0) {
      if (v.lider >= 0) comprar(v, ctx, v.lider, v.i, v.valor);
      else if (v.fase === "lotes") v.sem.push(v.i);
    }
    return abrirProximo(v, ctx, agora, carimbo);
  }
  function erro(motivo, v) { return { ok: false, motivo: motivo, vivo: v || null }; }
  function certo(v) { return { ok: true, vivo: limpo(v) }; }
  /** Lance de `alvo` do técnico t: aceito se o seq visto é o atual, o toque tem ≤ 2 s, o lote está aberto, ele pode e
   *  valor + 1 ≤ alvo ≤ máximo. opc: { toque (hora do toque, a do servidor), carimbo (o que gravar no lugar da hora) }. */
  function lance(v0, ctx, t, alvo, seqVisto, agora, opc) {
    opc = opc || {};
    if (!v0) return erro("fim");
    var v = norm(v0, ctx);
    if (v.fase === "fim") return erro("fim", v);
    if (v.seq !== seqVisto) return erro("seq", v);
    if (opc.toque != null && agora - opc.toque > TOQUE_MAX) return erro("velho", v);
    var pd = pode(v, ctx, t, agora);
    if (!pd.pode) return erro(pd.motivo, v);
    alvo = Math.floor(alvo);
    if (!(alvo >= v.valor + 1)) return erro("valor", v);
    if (alvo > pd.max) return erro("max", v);
    v.n++; v.lider = t; v.valor = alvo; v.t = opc.carimbo != null ? opc.carimbo : agora;
    v.h.push([t, alvo]); if (v.h.length > 5) v.h = v.h.slice(-5);
    return certo(v);
  }
  /** Passar (só neste lote). Todos passaram ou não podem: fecha na mesma transação. */
  function passar(v0, ctx, t, seqVisto, agora, opc) {
    opc = opc || {};
    if (!v0) return erro("fim");
    var v = norm(v0, ctx);
    if (v.fase === "fim") return erro("fim", v);
    if (v.seq !== seqVisto) return erro("seq", v);
    if (v.lider === t) return erro("lider", v);
    if (v.p.charAt(t) !== "1") v.p = v.p.slice(0, t) + "1" + v.p.slice(t + 1);
    if (todosPassaram(v, ctx)) return certo(fecharJa(v, ctx, agora, opc.carimbo));
    return certo(v);
  }
  /** Fecha o lote: a hora (a do servidor, pela testemunha) passou do fim, ou todos passaram. Fechar 2× = 1× (o seq). */
  function fechar(v0, ctx, seqVisto, agora, opc) {
    opc = opc || {};
    if (!v0) return erro("fim");
    var v = norm(v0, ctx);
    if (v.fase === "fim") return erro("fim", v);
    if (v.seq !== seqVisto) return erro("seq", v);
    if (agora < fimDoLote(v, ctx) && !todosPassaram(v, ctx)) return erro("cedo", v);
    return certo(fecharJa(v, ctx, agora, opc.carimbo));
  }

  /* ---------- leituras para as telas e a sessão ---------- */
  function timeDe(v0, ctx, t) {
    var v = norm(v0, ctx), tm = times(v, ctx)[t];
    return tm.lotes.map(function (i) { return ctx.lotes[i]; }).concat(tm.fora.map(function (j) { return ctx.fora[j]; }));
  }
  function proximos(v0, ctx, quantos) {
    var v = norm(v0, ctx), out = [];
    if (v.fase === "lotes") {
      for (var k = v.k + 1; k < ctx.fila.length && out.length < quantos; k++) if (v.d.charAt(ctx.fila[k]) === "-") out.push(ctx.fila[k]);
      for (var a = 0; a < v.sem.length && out.length < quantos; a++) out.push(v.sem[a]);
    } else if (v.fase === "rep") {
      for (var b = v.k + 1; b < v.sem.length && out.length < quantos; b++) if (v.d.charAt(v.sem[b]) === "-") out.push(v.sem[b]);
    }
    return out;
  }
  // os lotes ainda por vir (o atual incluso), na ordem
  function restantes(v, ctx) {
    var out = [];
    if (v.fase === "lotes") {
      for (var k = Math.max(0, v.k); k < ctx.fila.length; k++) if (v.d.charAt(ctx.fila[k]) === "-") out.push(ctx.fila[k]);
      v.sem.forEach(function (i) { if (v.d.charAt(i) === "-" && out.indexOf(i) < 0) out.push(i); });
    } else if (v.fase === "rep") {
      for (var b = Math.max(0, v.k); b < v.sem.length; b++) if (v.d.charAt(v.sem[b]) === "-") out.push(v.sem[b]);
    }
    return out;
  }
  function vendidoPorTec(v0, ctx) {
    var v = norm(v0, ctx);
    return times(v, ctx).map(function (tm) { return tm.n; });
  }

  /* ---------- a conferência (§3.3): cada vivo novo contra o anterior ---------- */
  function confereSozinho(v, ctx) {
    var T = ctx.T;
    if (!v || typeof v !== "object") return "estrutura";
    if (v.cx.length !== T) return "estrutura";
    if (v.d.length !== ctx.L) return "estrutura";
    if (v.f && v.f.length !== ctx.fora.length) return "estrutura";
    if (["lotes", "rep", "fim"].indexOf(v.fase) < 0) return "estrutura";
    var tm = times(v, ctx);
    for (var t = 0; t < T; t++) {
      var c = v.cx[t];
      if (c.length !== 6) return "estrutura";
      for (var x = 0; x < 6; x++) if (typeof c[x] !== "number" || c[x] !== Math.floor(c[x]) || c[x] < 0) return "caixa";
      if (c[0] > SALDO) return "caixa";
      if (c[1] !== VAGAS - tm[t].n) return "caixa";
      var porPos = [0, 0, 0, 0];
      tm[t].lotes.forEach(function (i) { porPos[ctx.gL[i]]++; });
      tm[t].fora.forEach(function (j) { porPos[ctx.gF[j]]++; });
      for (var g = 0; g < 4; g++) if (c[2 + g] !== porPos[g]) return "caixa";
      // cada compra custou pelo menos R$ 1 e sobra R$ 1 para cada vaga
      if (c[0] > SALDO - tm[t].lotes.length) return "caixa";
      if (c[0] < c[1]) return "caixa";
      if (!cabeAlguma(tm[t].cnt)) return "time";
    }
    if (v.fase !== "fim") {
      if (v.i < 0 || v.i >= ctx.L || v.d.charAt(v.i) !== "-") return "lote";
      if (v.lider >= 0) {
        if (v.lider >= T || v.valor < 1 || v.valor > maximo(v, v.lider) || !cabeLote(v, ctx, v.lider, v.i)) return "lance";
      } else if (v.valor !== 0) return "lance";
    }
    return null;
  }
  // mesmo lote: só podem mudar n/lider/valor/t/h (lances que sobem) e p (passes que entram)
  function confereNoLote(a, b, ctx) {
    if (a.i !== b.i || a.k !== b.k || a.fase !== b.fase || a.d !== b.d || (a.f || "") !== (b.f || "")) return "lote";
    if (JSON.stringify(a.cx) !== JSON.stringify(b.cx) || JSON.stringify(a.sem) !== JSON.stringify(b.sem)) return "caixa";
    for (var t = 0; t < ctx.T; t++) if (a.p.charAt(t) === "1" && b.p.charAt(t) !== "1") return "passe";
    if (b.n < a.n) return "lance";
    if (b.n === a.n) { if (b.lider !== a.lider || b.valor !== a.valor) return "lance"; return null; }
    if (b.valor <= a.valor) return "lance";
    if (b.valor > maximo(b, b.lider)) return "lance";
    if (b.n === a.n + 1 && (b.lider === a.lider || a.p.charAt(b.lider) === "1")) return "lance";
    return null;
  }
  /** Confere o vivo `novo` contra o `ant` (pode ser null) com as mesmas funções puras: { ok, motivo }.
   *  Acusa saldo que sobe, lance acima do máximo, venda sem dinheiro, dono que muda, fechamento que não bate. */
  function conferir(ant0, novo0, ctx) {
    if (!novo0) return { ok: false, motivo: "estrutura" };
    var b = norm(novo0, ctx), m = confereSozinho(b, ctx);
    if (m) return { ok: false, motivo: m };
    if (!ant0) return { ok: true, motivo: null };
    var a = norm(ant0, ctx);
    if (b.seq < a.seq) return { ok: false, motivo: "voltou" };
    for (var t = 0; t < ctx.T; t++) if (b.cx[t][0] > a.cx[t][0]) return { ok: false, motivo: "caixa" };
    for (var i = 0; i < ctx.L; i++) if (a.d.charAt(i) !== "-" && b.d.charAt(i) !== a.d.charAt(i)) return { ok: false, motivo: "dono" };
    if (b.seq === a.seq) { m = confereNoLote(a, b, ctx); return { ok: !m, motivo: m }; }
    if (b.seq === a.seq + 1 && a.fase !== "fim") {
      // o lote de `a` fechou (talvez com lances que o ouvinte não viu): quem comprou, por quanto, e o resto é conta
      var esp = norm(a, ctx), i0 = a.i, dono = idxLetra(b.d.charAt(i0));
      if (i0 >= 0 && dono >= 0) {
        var preco = a.cx[dono][0] - b.cx[dono][0];
        if (preco < Math.max(1, a.valor + (dono === a.lider ? 0 : 1)) || preco > maximo(a, dono)) return { ok: false, motivo: "fechamento" };
        if (dono !== a.lider && (a.p.charAt(dono) === "1" || !cabeLote(a, ctx, dono, i0))) return { ok: false, motivo: "fechamento" };
        comprar(esp, ctx, dono, i0, preco);
      } else if (i0 >= 0) {
        if (a.lider >= 0) return { ok: false, motivo: "fechamento" };
        if (esp.fase === "lotes") esp.sem.push(i0);
      }
      esp = abrirProximo(esp, ctx, b.abre, b.abre);
      if (esp.seq !== b.seq) return { ok: false, motivo: "fechamento" };
      esp.abre = b.abre;
      m = confereNoLote(esp, b, ctx);
      return { ok: !m, motivo: m ? "fechamento" : null };
    }
    return { ok: true, motivo: null };
  }

  /* ---------- robôs (§3.5) ---------- */
  /** O perfil de um robô pela semente da sala e pelo técnico: { t, perfil, agress, formacao }. */
  function perfilRobo(semente, t) {
    var r = rngDe(semente, "robo", t);
    var formas = ["4-4-2", "4-4-2", "4-3-3", "4-3-3", "3-5-2", "4-2-4", "5-4-1", "3-4-3"];
    return { t: t, perfil: PERFIS[Math.floor(r() * PERFIS.length)], agress: 0.9 + 0.2 * r(), formacao: formas[Math.floor(r() * formas.length)] };
  }
  // o mercado no lote atual (igual para todos os robôs): D_p, rep_p, o valor de cada lote restante, G e Σv
  // o último estado visto (a sessão e os robôs perguntam muitas vezes pelo mesmo lote): o mercado e os limites
  function mesmoEstado(a, v) {
    if (!a || a.seq !== v.seq || a.fase !== v.fase || a.k !== v.k || a.d !== v.d || a.sem.length !== v.sem.length || a.cx.length !== v.cx.length) return false;
    for (var i = 0; i < a.sem.length; i++) if (a.sem[i] !== v.sem[i]) return false;
    for (var t = 0; t < a.cx.length; t++) for (var x = 0; x < 6; x++) if (a.cx[t][x] !== v.cx[t][x]) return false;
    return true;
  }
  function cacheEstado(ctx, v) {
    var c = ctx._mk;
    if (c && mesmoEstado(c.v, v)) return c;
    return (ctx._mk = { v: { seq: v.seq, fase: v.fase, k: v.k, d: v.d, sem: v.sem.slice(), cx: v.cx.map(function (x) { return x.slice(); }) }, mk: null, lim: {} });
  }
  function mercado(v, ctx) {
    var c = cacheEstado(ctx, v);
    return c.mk || (c.mk = (function () {
      var rest = restantes(v, ctx), D = [0, 0, 0, 0], G = 0;
      for (var t = 0; t < ctx.T; t++) {
        var c = v.cx[t]; if (c[1] <= 0) continue;
        G += c[0] - c[1];
        var nec = 0, falta = [0, 0, 0, 0];
        for (var g = 0; g < 4; g++) { falta[g] = Math.max(0, ALVO[g] - c[2 + g]); nec += falta[g]; }
        // quem fugiu do alvo: a necessidade não passa das vagas (corta do maior)
        while (nec > c[1]) { var gm = 0; for (var g2 = 1; g2 < 4; g2++) if (falta[g2] > falta[gm]) gm = g2; falta[gm]--; nec--; }
        for (var g3 = 0; g3 < 4; g3++) D[g3] += falta[g3];
      }
      var porG = [[], [], [], []], cntRest = new Array(16).fill(0);
      rest.forEach(function (i) { porG[ctx.gL[i]].push(i); cntRest[ctx.mL[i]]++; });
      porG.forEach(function (l) { l.sort(function (x, y) { return ctx.rank[x] - ctx.rank[y]; }); });
      var val = {}, V = 0, sup = [0, 0, 0, 0];
      for (var g4 = 0; g4 < 4; g4++) {
        var l = porG[g4]; sup[g4] = l.length;
        var rep = l.length > D[g4] ? ctx.lotes[l[D[g4]]].overall : (l.length ? ctx.lotes[l[l.length - 1]].overall - 3 : 0);
        for (var x = 0; x < l.length; x++) {
          var vv = Math.pow(Math.max(0, ctx.lotes[l[x]].overall - rep), 1.5);
          val[l[x]] = vv;
          if (x < D[g4]) V += vv;
        }
      }
      return { D: D, G: G, V: V, val: val, sup: sup, rest: rest, cntRest: cntRest };
    })());
  }
  /** O limite do robô no lote atual (R$; nunca acima do máximo legal). Constante dentro do lote. */
  function limiteRobo(v0, ctx, bot, semente) {
    var v = norm(v0, ctx), t = bot.t, sem = semente != null ? semente : ctx.semente;
    if (v.fase === "fim" || v.i < 0 || vagas(v, t) <= 0) return 0;
    var c = cacheEstado(ctx, v), chave = t + "|" + bot.perfil + "|" + bot.agress + "|" + bot.formacao + "|" + sem;
    if (c.lim[chave] != null) return c.lim[chave];
    return (c.lim[chave] = (function () {
      var max = maximo(v, t), i = v.i, g = ctx.gL[i], lote = ctx.lotes[i];
      var tm = times(v, ctx)[t], cnt = comMais(tm.cnt, ctx.mL[i]);
      if (!cabeAlguma(cnt)) return 0;
      var mk = mercado(v, ctx);
      // fim de jogo: com vagas ≥ os lotes que cabem e restam, vai até o máximo legal
      var cabem = 0;
      for (var m = 1; m < 16; m++) if (mk.cntRest[m] && cabeAlguma(comMais(tm.cnt, m))) cabem += mk.cntRest[m];
      if (vagas(v, t) >= cabem) return max;
      var M = 1 + (mk.V > 0 ? mk.G * (mk.val[i] || 0) / mk.V : 0);
      var nec = cabeEm(cnt, bot.formacao) ? 1 : 0.5;
      if (mk.sup[g] <= mk.D[g]) nec *= 1.3;
      var naForma = VAGAS_FORM[bot.formacao] || ALVO, tem = v.cx[t][2 + g];
      if (naForma[g] - tem === 1 && mk.sup[g] <= ctx.T) nec *= 1.5;
      var prog = v.fase === "rep" ? 1 : (v.k + 1) / Math.max(1, ctx.fila.length);
      var perf = bot.perfil === "estrelas" ? (lote.overall >= ctx.p80 ? 1.25 : 0.8)
        : bot.perfil === "paciente" ? (prog < 0.5 ? 0.85 : 1.15) : 1;
      var r = rngRapido(sem, "limite", v.seq, t, 0);
      var ruido = 0.9 + 0.2 * r();
      var teto = Math.max(1, Math.floor(v.cx[t][0] * (TETO_PERFIL[bot.perfil] || 0.35)));
      var L = Math.round(M * nec * perf * (bot.agress || 1) * ruido);
      return Math.max(0, Math.min(max, L, teto));
    })());
  }
  /** A ação do robô no estado atual: { acao: 'lance'|'passar', alvo, quando } ou null (lidera, passou, não pode, fim).
   *  `quando` = 0,7–2,5 s depois do último acontecimento (o lote abrir ou o último lance), nunca com menos de 0,6 s. */
  function robo(v0, ctx, bot, semente) {
    if (!v0) return null;
    var v = norm(v0, ctx), t = bot.t;
    if (v.fase === "fim" || v.i < 0 || v.lider === t || v.p.charAt(t) === "1") return null;
    if (!podeCobrir(v, ctx, t)) return null;
    var sem = semente != null ? semente : ctx.semente;
    var L = limiteRobo(v, ctx, bot, sem);
    var r = rngRapido(sem, "acao", v.seq, v.n, t);
    var base = Math.max(v.abre + ctx.espera, v.n > 0 ? v.t : 0), fim = fimDoLote(v, ctx);
    var quando = Math.max(base, Math.min(base + 700 + Math.floor(r() * 1800), fim - 600));
    if (v.valor + 1 > L) return { acao: "passar", quando: quando };
    var passo = 1;
    if (v.valor + 5 < L * 0.5) passo = 2 + Math.floor(r() * 4);
    return { acao: "lance", alvo: Math.min(L, v.valor + passo), quando: quando };
  }
  /** A transação do robô (qualquer aparelho, idempotente): refaz a conta no estado ATUAL; se o estado mudou desde o
   *  que o aparelho viu (seq ou n), aborta. */
  function aplicarRobo(v0, ctx, bot, seqVisto, nVisto, agora, opc) {
    if (!v0) return erro("fim");
    var v = norm(v0, ctx);
    if (v.seq !== seqVisto || v.n !== nVisto) return erro("seq", v);
    var a = robo(v, ctx, bot, opc && opc.semente);
    if (!a) return erro("nada", v);
    if (a.acao === "lance") return lance(v, ctx, bot.t, a.alvo, seqVisto, agora, { carimbo: opc && opc.carimbo });
    return passar(v, ctx, bot.t, seqVisto, agora, { carimbo: opc && opc.carimbo });
  }

  TM.leilao = {
    REGRAS: REGRAS, SALDO: SALDO, VAGAS: VAGAS, LOTES_POR_TEC: LOTES_POR_TEC, TEC_MIN: TEC_MIN, TEC_MAX: TEC_MAX,
    DUR: DUR, EXT: EXT, ESPERA: ESPERA, DUR_REP: DUR_REP, TOQUE_MAX: TOQUE_MAX, TEMPOS: TEMPOS,
    GRUPOS: GRUPOS, FORMACOES: FORMACOES, VAGAS_FORM: VAGAS_FORM, PERFIS: PERFIS,
    // lotes e ordem
    cotas: cotas, criarLotes: criarLotes, jogadoresDaLiga: jogadoresDaLiga, retrato: retrato, ordem: ordem, contexto: contexto,
    // a máquina
    inicial: inicial, lance: lance, passar: passar, fechar: fechar, fimDoLote: fimDoLote, todosPassaram: function (v, ctx) { return todosPassaram(norm(v, ctx), ctx); },
    pode: pode, maximo: function (v, ctx, t) { return maximo(norm(v, ctx), t); }, norm: norm, limpo: limpo, letra: letra, LETRAS: LETRAS,
    // times e formações
    timeDe: timeDe, cabeEm: cabeEm, formacoesQueCabem: formacoesQueCabem, formacaoPara: formacaoPara, contaMascaras: contaMascaras,
    encaixe: encaixe, proximos: proximos, vendidoPorTec: vendidoPorTec,
    // a escalação
    timeIdx: timeIdx, retratoDe: retratoDe, slotsDe: slotsDe, custoVaga: custoVaga, escalacao: escalacao,
    escalacaoDe: escalacaoDe, trocarVagas: trocarVagas, FORA_VAGA: FORA_VAGA, _hungaro: hungaro,
    cabeLote: function (v, ctx, t, i) { return cabeLote(norm(v, ctx), ctx, t, i == null ? v.i : i); },
    // conferência e robôs
    conferir: conferir, perfilRobo: perfilRobo, robo: robo, limiteRobo: limiteRobo, aplicarRobo: aplicarRobo
  };
})(window);
