#!/usr/bin/env node
/* Testes do Modo Leilão (PLANO-LEILAO.md §4.1), em Node, sem navegador e sem rede.
   Carrega num `vm` o rng.js, o data.js (com um TM.storage falso), o viverde.js, o competitions.js, o ultimate.js (as
   listas do escudo desenhado; o TM.ui de mentira) e os arquivos do leilão, nas duas edições (pública e pro), e roda:
     L1 lotes · L2 ordem · L3 lance · L4 relógio · L5 fechar · L6 fim · L7 robôs · L8 protocolo (o leilão inteiro
     pela sessão e pela rede em memória = a máquina pura) · L9 formações e escalação · L10 conferência ·
     R a rede em memória · S a sessão (botões, motivos, formação, escalação, recarregar, sair, Minhas salas)
   Uma linha por bloco; o código de saída é 1 se algum reprovar.
   Uso: node ferramentas/testar-leilao.mjs [--so L1,L7] [--leiloes 1000] [-v]
   (--tela, o navegador, vem no passo das telas.) Nenhum teste usa o Firebase. */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n, p) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : p; };
const SO = opt("--so", null) ? opt("--so").split(",").map(s => s.trim().toUpperCase()) : null;
const N_LEILOES = +opt("--leiloes", 1000);
const VERBOSO = args.includes("-v");
const ARQS = ["js/rng.js", "js/data.js", "js/viverde.js", "js/competitions.js", "js/ultimate.js", "js/leilao.js", "js/leilao-rede.js", "js/leilao-sessao.js"];

/* ---------- o carregador: um mundo por edição, com um TM.storage falso ---------- */
function carrega(ed, guardado) {
  const store = Object.assign({}, guardado || {});
  const ctx = { console, Math, Date, JSON, Promise, setTimeout, clearTimeout, Uint32Array, crypto: globalThis.crypto };
  ctx.window = ctx;
  vm.createContext(ctx);
  ctx.TM = {
    storage: {
      edition: () => ed,
      read: (k, f) => (k in store ? JSON.parse(store[k]) : f),
      write: (k, v) => { store[k] = JSON.stringify(v); return true; },
      remove: k => { delete store[k]; },
      readRaw: () => null, writeRaw: () => true, removeRaw: () => {},
      suUnlocked: () => false,
      settings: () => ({})
    },
    // o ultimate.js só usa o TM.ui nas telas: na carga, basta existir
    ui: { el: () => null, register: () => {}, go: () => {} }
  };
  for (const f of ARQS) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), "utf8"), ctx, { filename: f });
  ctx.TM._store = store;
  return ctx.TM;
}

/* ---------- placar ---------- */
const resultados = [];
let falhas = 0;
function bloco(nome, titulo, fn) {
  if (SO && !SO.includes(nome)) return;
  const t0 = performance.now(), erros = [], notas = [];
  const ok = (c, msg) => { if (!c) erros.push(msg); return !!c; };
  try { fn(ok, s => notas.push(s)); } catch (e) { erros.push("exceção: " + (e && e.stack || e)); }
  const ms = performance.now() - t0;
  const linha = `${erros.length ? "REPROVOU" : "ok      "} ${nome.padEnd(4)} ${titulo}${notas.length ? " — " + notas.join("; ") : ""} (${(ms / 1000).toFixed(1)} s)`;
  console.log(linha);
  if (erros.length) {
    falhas++;
    erros.slice(0, VERBOSO ? 200 : 8).forEach(e => console.log("         · " + e));
    if (erros.length > 8 && !VERBOSO) console.log(`         · … mais ${erros.length - 8}`);
  }
  resultados.push({ nome, ok: !erros.length });
}

const t00 = performance.now();
const TMs = { public: carrega("public"), pro: carrega("pro") };
const MUNDO = { public: TMs.public.data.mundoBase(), pro: TMs.pro.data.mundoBase() };
const LIGAS = MUNDO.public.leagues.map(l => l.id);
const LE = TMs.public.leilao;
const cacheLotes = {};
function lotesDe(ed, liga, T) {
  const k = ed + "|" + liga + "|" + T;
  return cacheLotes[k] || (cacheLotes[k] = TMs[ed].leilao.criarLotes(MUNDO[ed], liga, T));
}
function ctxDe(ed, liga, T, semente, extra) {
  const { lotes, fora } = lotesDe(ed, liga, T);
  return TMs[ed].leilao.contexto(Object.assign({ T, lotes, fora, semente }, extra || {}));
}
const GR = ["GK", "DF", "MF", "FW"];
const cmpNota = (a, b) => (b.overall - a.overall) || (String(a.id).length - String(b.id).length) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
function jsonIgual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* ---------- o motor de leilão só de robôs (o relógio é o dos acontecimentos) ---------- */
// politica(v, ctx, t) devolve a ação de um técnico "humano" de teste (ou null); sem política, todos são robôs
function leilaoRobos(ctx, o) {
  o = o || {};
  const L = o.LE || LE, T = ctx.T, bots = [];
  for (let t = 0; t < T; t++) bots.push(L.perfilRobo(ctx.semente, t));
  let agora = 1000, v = L.inicial(ctx, agora), passos = 0;
  const estados = [v], vendas = [], erros = [];
  while (v.fase !== "fim" && passos < 20000) {
    passos++;
    let melhor = null;
    for (const b of bots) {
      if (o.humanos && o.humanos.includes(b.t)) continue;
      const a = L.robo(v, ctx, b);
      if (a && (!melhor || a.quando < melhor.a.quando)) melhor = { a, b };
    }
    if (o.politica) for (const t of o.humanos || []) {
      const a = o.politica(v, ctx, t);
      if (a && (!melhor || a.quando < melhor.a.quando)) melhor = { a, b: { t }, humano: true };
    }
    const fim = L.fimDoLote(v, ctx);
    let r;
    if (melhor && melhor.a.quando < fim) {
      agora = Math.max(agora, melhor.a.quando);
      if (melhor.humano) r = melhor.a.acao === "lance" ? L.lance(v, ctx, melhor.b.t, melhor.a.alvo, v.seq, agora) : L.passar(v, ctx, melhor.b.t, v.seq, agora);
      else r = L.aplicarRobo(v, ctx, melhor.b, v.seq, v.n || 0, agora);
      if (!r.ok) { erros.push("ação recusada: " + r.motivo + " (" + (melhor.humano ? "humano" : "robô") + " " + melhor.b.t + ")"); break; }
      // todos os outros passaram ou não podem: quem viu fecha na hora (a sessão faz o mesmo)
      if (r.vivo.seq === v.seq && L.todosPassaram(r.vivo, ctx)) {
        estados.push(r.vivo);
        const r2 = L.fechar(r.vivo, ctx, r.vivo.seq, agora);
        if (!r2.ok) { erros.push("fechar depois de todos passarem: " + r2.motivo); break; }
        const ultimo = r.vivo; r = r2;
        if ((ultimo.lider ?? -1) >= 0) vendas.push({ i: ultimo.i, t: ultimo.lider, preco: ultimo.valor });
      } else if (r.vivo.seq !== v.seq && (v.lider ?? -1) >= 0) vendas.push({ i: v.i, t: v.lider, preco: v.valor });
    } else {
      agora = Math.max(agora, fim);
      r = L.fechar(v, ctx, v.seq, agora);
      if (!r.ok) { erros.push("fechar na hora: " + r.motivo); break; }
      if ((v.lider ?? -1) >= 0) vendas.push({ i: v.i, t: v.lider, preco: v.valor });
    }
    v = r.vivo;
    estados.push(v);
  }
  if (v.fase !== "fim") erros.push("não terminou em " + passos + " passos");
  return { v, estados, vendas, erros, minutos: (agora - 1000) / 60000, bots };
}
function rngT(s) { return TMs.public.rng.make(TMs.public.rng.hashStr(String(s))); }

/* ===================================================== L1 lotes ===================================================== */
bloco("L1", "lotes por cota de posição do mundo-base", (ok, nota) => {
  let casos = 0, falta = 0;
  const curtos = [];
  for (const ed of ["public", "pro"]) {
    const W = MUNDO[ed], L = TMs[ed].leilao;
    for (const liga of LIGAS) {
      const lg = W.leaguesById[liga], doLiga = new Set(lg.clubIds);
      // todos os jogadores elegíveis da liga, para conferir "os melhores"
      const todos = [];
      lg.clubIds.forEach(cid => { const c = W.clubsById[cid]; if (c.custom || c.viverde || c.especial) return; c.playerIds.forEach(pid => { const p = W.playersById[pid]; if (p && !p.especial) todos.push(p); }); });
      for (let T = 2; T <= 8; T++) {
        casos++;
        const { lotes, fora } = L.criarLotes(W, liga, T), q = L.cotas(T), id = `${ed}/${liga}/T${T}`;
        ok(lotes.length === 13 * T, `${id}: ${lotes.length} lotes (esperado ${13 * T})`);
        ok(q.GK + q.DF + q.MF + q.FW === 13 * T && q.DF - q.MF >= 0 && q.DF - q.MF <= 1, `${id}: cotas ${JSON.stringify(q)}`);
        for (const g of GR) {
          const n = lotes.filter(l => l.pos === g).length;
          if (n !== q[g]) { falta++; ok(false, `${id}: ${n} ${g} (cota ${q[g]})`); }
          // os melhores do grupo: nenhum de fora dos lotes passa um do lote
          const noLote = new Set(lotes.map(l => l.id));
          const piorLote = lotes.filter(l => l.pos === g).sort(cmpNota).pop();
          const melhorFora = todos.filter(p => p.pos === g && !noLote.has(p.id)).sort(cmpNota)[0];
          if (piorLote && melhorFora) ok(cmpNota(piorLote, melhorFora) < 0, `${id}: ${g} ${melhorFora.id}(${melhorFora.overall}) fora e ${piorLote.id}(${piorLote.overall}) no lote`);
          // fora: os melhores que sobraram, até o máximo do grupo numa formação por técnico (GK 1, DF 5, MF 5, FW 4);
          // nunca abaixo do mínimo de uma formação (GK 1, DF 3, MF 2, FW 1) por técnico: todos completam de graça
          const nf = fora.filter(l => l.pos === g).length, alvo = { GK: 1, DF: 5, MF: 5, FW: 4 }[g] * T, minimo = { GK: 1, DF: 3, MF: 2, FW: 1 }[g] * T;
          const sobra = todos.filter(p => p.pos === g && !noLote.has(p.id)).length;
          ok(nf === Math.min(alvo, sobra), `${id}: fora com ${nf} ${g} (alvo ${alvo}, sobram ${sobra})`);
          ok(nf >= minimo, `${id}: fora com ${nf} ${g}, abaixo do mínimo ${minimo}`);
          if (nf < alvo) curtos.push(`${id} ${g} ${nf}/${alvo}`);
        }
        const ids = lotes.concat(fora).map(l => l.id);
        ok(new Set(ids).size === ids.length, `${id}: jogador repetido`);
        for (const l of lotes.concat(fora)) {
          if (!doLiga.has(l.clubId)) { ok(false, `${id}: ${l.id} de fora da liga (${l.clubId})`); break; }
          const c = W.clubsById[l.clubId], p = W.playersById[l.id];
          if (c.custom || c.viverde || c.especial || l.clubId === "viverde" || (p && p.especial)) { ok(false, `${id}: ${l.id} especial/criado/Viverde`); break; }
          const campos = ["id", "name", "pos", "grupos", "overall", "attrs", "nationId", "clubId", "homeClubId", "number", "height", "weight"];
          const sem = campos.filter(k => l[k] == null);
          if (sem.length) { ok(false, `${id}: ${l.id} sem ${sem.join(",")}`); break; }
          if (l.grupos[0] !== l.pos) { ok(false, `${id}: ${l.id} grupos ${l.grupos} sem a posição principal na frente`); break; }
        }
        // determinístico: duas gerações do mundo-base dão os mesmos lotes
        if (T === 4 && (liga === "br" || liga === "en")) ok(jsonIgual(L.criarLotes(TMs[ed].data.mundoBase(), liga, T), { lotes, fora }), `${id}: outro mundo-base, outros lotes`);
      }
    }
  }
  // com o clube criado, o Viverde no lugar de um clube e o Editor no armazenamento, os lotes não mudam
  for (const ed of ["public", "pro"]) {
    const guardado = {
      customClub: JSON.stringify({ slotClubId: "br-0", fixo: "viverde" }),
      edits: JSON.stringify({
        players: { [MUNDO[ed].clubsById["br-1"].playerIds[0]]: { overall: 99, pos: "GK", name: "Editado" } },
        moves: { [MUNDO[ed].clubsById["en-0"].playerIds[0]]: "br-2" },
        created: [{ id: "ed0", clubId: "br-3", name: "Criado", pos: "FW", overall: 95 }]
      })
    };
    const TMe = carrega(ed, guardado);
    const carreira = TMe.data.world();
    ok(carreira.clubsById["br-0"].custom && carreira.playersById.ed0, `${ed}: o armazenamento falso não montou a carreira com o clube criado/Editor`);
    for (const liga of ["br", "en"]) for (const T of [4, 8]) {
      const com = TMe.leilao.criarLotes(TMe.data.mundoBase(), liga, T), sem = lotesDe(ed, liga, T);
      ok(jsonIgual(com, sem), `${ed}/${liga}/T${T}: com edições e clube criado, os lotes mudaram`);
    }
    ok(TMe.data.world() === carreira, `${ed}: o mundoBase mexeu no cache da carreira`);
  }
  nota(`${casos} casos (30 ligas × 2 edições × T 2–8)${falta ? ", " + falta + " cotas faltando" : ""}; fora abaixo do alvo em ${curtos.length} (${curtos.join(", ")})`);
});

/* ===================================================== L2 ordem ===================================================== */
bloco("L2", "ordem dos lotes pela semente", (ok, nota) => {
  let casos = 0, blocos = 0, blocosVariados = 0, faixasVariadas = 0, primeiroGk = 0;
  for (const ed of ["public", "pro"]) for (const liga of LIGAS) for (let T = 2; T <= 8; T++) {
    const { lotes } = lotesDe(ed, liga, T), L = lotes.length;
    for (const sem of ["s1-" + liga, "outra-" + T]) {
      casos++;
      const fila = LE.ordem(lotes, sem, T), id = `${ed}/${liga}/T${T}/${sem}`;
      ok(fila.length === L && new Set(fila).size === L && fila.every(i => i >= 0 && i < L), `${id}: não é permutação`);
      ok(jsonIgual(fila, LE.ordem(lotes, sem, T)), `${id}: mesma semente, outra ordem`);
      const gks = fila.map((li, k) => lotes[li].pos === "GK" ? k : -1).filter(k => k >= 0);
      const lim = Math.max(1, Math.floor(0.2 * L));
      ok(gks[0] < lim, `${id}: 1º goleiro em ${gks[0]} (limite ${lim})`);
      ok(gks.every(k => k < L - T), `${id}: goleiro no último bloco`);
      primeiroGk += gks[0] / L;
      // blocos de T: posições e faixas de nota variadas
      const ovs = lotes.map(l => l.overall).sort((a, b) => a - b), corte = ovs[Math.floor(L / 2)];
      for (let b = 0; b + T <= L; b += T) {
        const bl = fila.slice(b, b + T).map(i => lotes[i]);
        blocos++;
        if (new Set(bl.map(l => l.pos)).size >= 2) blocosVariados++;
        if (bl.some(l => l.overall >= corte) && bl.some(l => l.overall < corte)) faixasVariadas++;
      }
    }
    ok(!jsonIgual(LE.ordem(lotes, "a", T), LE.ordem(lotes, "b", T)), `${ed}/${liga}/T${T}: sementes diferentes, mesma ordem`);
  }
  const pv = blocosVariados / blocos, fv = faixasVariadas / blocos;
  ok(pv >= 0.9, `blocos com 2+ posições: ${(pv * 100).toFixed(1)}% (meta ≥ 90%)`);
  ok(fv >= 0.6, `blocos com notas altas e baixas: ${(fv * 100).toFixed(1)}% (meta ≥ 60%)`);
  nota(`${casos} ordens; blocos com 2+ posições ${(pv * 100).toFixed(0)}%, com notas altas e baixas ${(fv * 100).toFixed(0)}%; 1º goleiro em média a ${(primeiroGk / casos * 100).toFixed(0)}% da fila`);
});

/* ================================= ajudantes dos blocos da máquina (um contexto pequeno) ================================= */
const C4 = ctxDe("public", "br", 4, "maquina");
function vivoAberto(ctx, agora) { const v = LE.inicial(ctx, agora || 0); return v; }
function abertoEm(v, ctx) { return v.abre + ctx.espera; }
// passa todos os técnicos neste lote (fecha sem lance)
function todosPassam(v, ctx, agora) {
  let r = { ok: true, vivo: v };
  for (let t = 0; t < ctx.T && r.vivo.seq === v.seq; t++) { r = LE.passar(r.vivo, ctx, t, v.seq, agora); if (!r.ok) return r; }
  return r;
}
// monta um vivo com o técnico t dono dos lotes `idx` (pela máquina: compras de R$ 1 no lote certo seria lento; aqui a conta)
function comCompras(ctx, v, t, idx, preco) {
  const n = JSON.parse(JSON.stringify(v));
  n.d = n.d.split("");
  idx.forEach(i => { n.d[i] = LE.letra(t); n.cx[t][0] -= preco; n.cx[t][1] -= 1; n.cx[t][2 + GR.indexOf(ctx.lotes[i].pos)]++; });
  n.d = n.d.join("");
  return n;
}

/* ===================================================== L3 lance ===================================================== */
bloco("L3", "lance: mínimo, máximo, Tudo, cabe, completo, seq, toque, valor, líder", (ok) => {
  const ctx = C4, v0 = vivoAberto(ctx, 0), a = abertoEm(v0, ctx) + 100, s = v0.seq;
  ok(v0.seq === 1 && v0.fase === "lotes" && v0.i === ctx.fila[0] && v0.k === 0, "vivo inicial");
  ok(v0.cx.every(c => jsonIgual(c, [100, 11, 0, 0, 0, 0])), "caixa inicial R$ 100 e 11 vagas");
  let r = LE.lance(v0, ctx, 0, 1, s, v0.abre + 10);
  ok(!r.ok && r.motivo === "pausa", "lance na pausa entre lotes: " + r.motivo);
  r = LE.lance(v0, ctx, 0, 0, s, a); ok(!r.ok && r.motivo === "valor", "lance de R$ 0: " + r.motivo);
  r = LE.lance(v0, ctx, 0, 1, s, a); ok(r.ok && r.vivo.valor === 1 && r.vivo.lider === 0 && r.vivo.n === 1, "lance mínimo de R$ 1");
  const v1 = r.vivo;
  r = LE.lance(v1, ctx, 1, 1, s, a + 100); ok(!r.ok && r.motivo === "valor", "lance igual ao atual: " + r.motivo);
  r = LE.lance(v1, ctx, 0, 5, s, a + 100); ok(!r.ok && r.motivo === "lider", "o líder dá outro lance: " + r.motivo);
  r = LE.passar(v1, ctx, 0, s, a + 100); ok(!r.ok && r.motivo === "lider", "o líder passa: " + r.motivo);
  // máximo = saldo − (vagas − 1)
  const vm = JSON.parse(JSON.stringify(v1)); vm.cx[2] = [30, 11, 0, 0, 0, 0];
  ok(LE.maximo(vm, ctx, 2) === 20 && LE.pode(vm, ctx, 2, a + 100).max === 20, "máximo de R$ 30 com 11 vagas = R$ 20");
  r = LE.lance(vm, ctx, 2, 21, s, a + 100); ok(!r.ok && r.motivo === "max", "acima do máximo: " + r.motivo);
  r = LE.lance(vm, ctx, 2, 20, s, a + 100); ok(r.ok && r.vivo.valor === 20, "Tudo (o máximo)");
  ok(LE.maximo(v1, ctx, 3) === 90, "máximo inicial R$ 90");
  // com o máximo abaixo do valor + 1 não pode
  const vm2 = JSON.parse(JSON.stringify(v1)); vm2.valor = 20; vm2.cx[2] = [30, 11, 0, 0, 0, 0];
  ok(LE.pode(vm2, ctx, 2, a + 100).motivo === "max", "máximo R$ 20 com valor R$ 20: não pode");
  // não cabe: já tem goleiro e o lote é goleiro
  const iGk = ctx.lotes.findIndex(l => l.pos === "GK"), outroGk = ctx.lotes.findIndex((l, i) => l.pos === "GK" && i !== iGk);
  let vg = JSON.parse(JSON.stringify(v0)); vg.i = outroGk; vg = comCompras(ctx, vg, 1, [iGk], 3);
  r = LE.lance(vg, ctx, 1, 1, s, a); ok(!r.ok && r.motivo === "goleiro", "dois goleiros: " + r.motivo);
  ok(LE.lance(vg, ctx, 0, 1, s, a).ok, "quem não tem goleiro pode");
  // sem vaga que sirva: o grupo cheio na formação que mais o aceita (5 DF, 5 MF ou 4 FW, todos só daquele grupo) e
  // mais um só daquele grupo
  const MAXG = { DF: 5, MF: 5, FW: 4 };
  let testouPosicao = false;
  for (const ctxP of [ctx, ctxDe("public", "br", 8, "maquina"), ctxDe("public", "en", 8, "maquina")]) {
    for (const g of ["DF", "MF", "FW"]) {
      const puros = ctxP.lotes.map((l, i) => l.grupos.length === 1 && l.pos === g ? i : -1).filter(i => i >= 0);
      if (puros.length < MAXG[g] + 1 || testouPosicao) continue;
      const vp0 = LE.inicial(ctxP, 0);
      let vf = JSON.parse(JSON.stringify(vp0)); vf.i = puros[MAXG[g]]; vf = comCompras(ctxP, vf, 1, puros.slice(0, MAXG[g]), 1);
      r = LE.lance(vf, ctxP, 1, 1, vf.seq, abertoEm(vf, ctxP) + 10);
      ok(!r.ok && r.motivo === "posicao", `${MAXG[g]} ${g} só ${g} + outro: ${r.motivo}`);
      testouPosicao = true;
    }
  }
  ok(testouPosicao, "nenhuma liga com jogadores de um grupo só para o teste de 'sem vaga que sirva'");
  // completo
  const vc = JSON.parse(JSON.stringify(v0)); vc.cx[3] = [50, 0, 1, 4, 4, 2];
  r = LE.lance(vc, ctx, 3, 1, s, a); ok(!r.ok && r.motivo === "completo", "time completo: " + r.motivo);
  // seq visto diferente
  r = LE.lance(v0, ctx, 0, 1, s + 1, a); ok(!r.ok && r.motivo === "seq", "seq diferente: " + r.motivo);
  // toque velho (> 2 s) e toque recente
  r = LE.lance(v0, ctx, 0, 1, s, a + 2600, { toque: a + 100 }); ok(!r.ok && r.motivo === "velho", "toque de 2,5 s atrás: " + r.motivo);
  r = LE.lance(v0, ctx, 0, 1, s, a + 1500, { toque: a + 100 }); ok(r.ok, "toque de 1,4 s atrás");
  // a repescagem do MESMO lote tem outro seq: o lance velho guardado é recusado
  let v = v0, ag = a;
  const primeiro = v0.i;
  while (v.fase === "lotes") { const rr = todosPassam(v, ctx, ag); if (!rr.ok) { ok(false, "passar: " + rr.motivo); break; } v = rr.vivo; ag += 10; }
  ok(v.fase === "rep" && v.i === primeiro && (v.sem || [])[0] === primeiro, `repescagem abre no 1º lote (fase ${v.fase}, i ${v.i})`);
  r = LE.lance(v, ctx, 0, 1, s, abertoEm(v, ctx) + 10); ok(!r.ok && r.motivo === "seq", "lance com o seq do mesmo lote na fase de lotes: " + r.motivo);
  r = LE.lance(v, ctx, 0, 1, v.seq, abertoEm(v, ctx) + 10); ok(r.ok, "lance com o seq da repescagem");
  // alvo que não é número
  r = LE.lance(v0, ctx, 0, "abc", s, a); ok(!r.ok && r.motivo === "valor", "alvo inválido: " + r.motivo);
});

/* ===================================================== L4 relógio ===================================================== */
bloco("L4", "relógio do lote: 10 s, volta a 8 s, fim derivado", (ok) => {
  const ctx = C4, v0 = vivoAberto(ctx, 5000), ini = abertoEm(v0, ctx);
  ok(LE.fimDoLote(v0, ctx) === v0.abre + 1500 + 10000, "fim = abre + 1,5 s + 10 s");
  // lance com 9 s faltando: o fim não muda
  let r = LE.lance(v0, ctx, 0, 1, v0.seq, ini + 1000); ok(r.ok && LE.fimDoLote(r.vivo, ctx) === ini + 10000, "lance com 9 s faltando: fim igual");
  // lance com 3 s faltando: volta a 8 s
  r = LE.lance(r.vivo, ctx, 1, 2, v0.seq, ini + 7000); ok(r.ok && LE.fimDoLote(r.vivo, ctx) === ini + 7000 + 8000, "lance com 3 s faltando: 8 s de novo");
  const fim = LE.fimDoLote(r.vivo, ctx);
  let r2 = LE.lance(r.vivo, ctx, 2, 3, v0.seq, fim); ok(!r2.ok && r2.motivo === "tarde", "lance na hora do fim: " + r2.motivo);
  r2 = LE.lance(r.vivo, ctx, 2, 3, v0.seq, fim - 1); ok(r2.ok, "lance 1 ms antes do fim");
  // a hora do lance gravada pelo carimbo (o TIMESTAMP do servidor)
  r2 = LE.lance(r.vivo, ctx, 2, 3, v0.seq, fim - 1, { carimbo: { ".sv": "timestamp" } }); ok(r2.ok && r2.vivo.t && r2.vivo.t[".sv"] === "timestamp", "carimbo no lugar da hora");
  // tempo do lote de 20 s: dur 20 s, extensão 8 s
  const c20 = ctxDe("public", "br", 4, "maquina", { tempo: 20000 }), v20 = LE.inicial(c20, 0);
  ok(LE.fimDoLote(v20, c20) === 1500 + 20000 && c20.ext === 8000, "tempo do lote de 20 s");
  // repescagem: 6 s e lance com menos de 6 s volta a 6 s
  let v = v0, ag = ini;
  while (v.fase === "lotes") { v = todosPassam(v, ctx, ag).vivo; ag += 10; }
  ok(v.fase === "rep" && LE.fimDoLote(v, ctx) === v.abre + 1500 + 6000, "repescagem: 6 s");
  const ir = abertoEm(v, ctx);
  r = LE.lance(v, ctx, 0, 1, v.seq, ir + 5000); ok(r.ok && LE.fimDoLote(r.vivo, ctx) === ir + 5000 + 6000, "repescagem: lance com 1 s faltando volta a 6 s");
});

/* ===================================================== L5 fechar ===================================================== */
bloco("L5", "fechar: vendido, sem lance, todos passaram, pulado, idempotente", (ok) => {
  const ctx = C4, v0 = vivoAberto(ctx, 0), ini = abertoEm(v0, ctx);
  let r = LE.lance(v0, ctx, 1, 7, v0.seq, ini + 100), v1 = r.vivo;
  r = LE.fechar(v1, ctx, v0.seq, ini + 5000); ok(!r.ok && r.motivo === "cedo", "fechar antes da hora: " + r.motivo);
  const fim = LE.fimDoLote(v1, ctx);
  r = LE.fechar(v1, ctx, v0.seq, fim);
  ok(r.ok && r.vivo.seq === v0.seq + 1 && r.vivo.d[v0.i] === "b", "vendido: o dono do lote");
  const g = GR.indexOf(ctx.lotes[v0.i].pos);
  ok(r.ok && r.vivo.cx[1][0] === 93 && r.vivo.cx[1][1] === 10 && r.vivo.cx[1][2 + g] === 1, "vendido: o caixa desconta R$ 7 e uma vaga");
  ok(r.ok && r.vivo.k === 1 && r.vivo.i === ctx.fila[1] && r.vivo.abre === fim && (r.vivo.lider ?? -1) === -1 && !r.vivo.valor, "o próximo lote abre");
  // fechar 2× = 1×
  const r2 = LE.fechar(v1, ctx, v0.seq, fim + 50); ok(r2.ok && jsonIgual(Object.assign({}, r2.vivo, { abre: 0 }), Object.assign({}, r.vivo, { abre: 0 })), "fechar do mesmo estado: o mesmo resultado");
  const r3 = LE.fechar(r.vivo, ctx, v0.seq, fim + 50); ok(!r3.ok && r3.motivo === "seq", "fechar de novo com o seq velho: " + r3.motivo);
  // sem lance → repescagem
  const fim0 = LE.fimDoLote(v0, ctx);
  r = LE.fechar(v0, ctx, v0.seq, fim0); ok(r.ok && jsonIgual(r.vivo.sem, [v0.i]) && r.vivo.d[v0.i] === "-", "sem lance: vai para a repescagem");
  // todos passaram (sem líder): fecha na hora, sem lance
  r = todosPassam(v0, ctx, ini + 200); ok(r.ok && r.vivo.seq === v0.seq + 1 && jsonIgual(r.vivo.sem, [v0.i]), "todos passaram: fecha na hora");
  // com líder: os outros passam → vendido na hora
  let v = v1, s = v1.seq;
  for (const t of [0, 2]) { r = LE.passar(v, ctx, t, s, ini + 300); v = r.vivo; ok(r.ok && v.seq === s, "passar " + t + " ainda não fecha"); }
  r = LE.passar(v, ctx, 3, s, ini + 400); ok(r.ok && r.vivo.seq === s + 1 && r.vivo.d[v0.i] === "b" && r.vivo.cx[1][0] === 93, "o último passa: vendido na hora");
  // quem não pode conta como "passou": com 3 técnicos que já têm goleiro, só um passa e o goleiro fecha
  const iGk = ctx.fila.find(i => ctx.lotes[i].pos === "GK"), kGk = ctx.fila.indexOf(iGk);
  const gksDeFora = ctx.lotes.map((l, i) => l.pos === "GK" && i !== iGk ? i : -1).filter(i => i >= 0);
  let vg = JSON.parse(JSON.stringify(v0)); vg.k = kGk; vg.i = iGk;
  for (let t = 0; t < 3; t++) vg = comCompras(ctx, vg, t, [gksDeFora[t]], 2);
  r = LE.passar(vg, ctx, 3, vg.seq, ini + 100); ok(r.ok && r.vivo.seq === vg.seq + 1 && (r.vivo.sem || []).includes(iGk), "os outros não podem: o único que pode passa e fecha");
  // ninguém pode: o lote é pulado (nem vai para a repescagem)
  let vp = JSON.parse(JSON.stringify(v0));
  for (let t = 0; t < 4; t++) vp = comCompras(ctx, vp, t, [gksDeFora[t]], 2);
  const gkRestante = ctx.lotes.map((l, i) => l.pos === "GK" && !gksDeFora.slice(0, 4).includes(i) ? i : -1).filter(i => i >= 0)[0];
  const kg = ctx.fila.indexOf(gkRestante);
  vp.k = kg - 1; vp.i = ctx.fila[kg - 1];
  if (vp.d[vp.i] !== "-") { ok(false, "montagem do pulado"); return; }
  r = LE.fechar(vp, ctx, vp.seq, LE.fimDoLote(vp, ctx));
  ok(r.ok && r.vivo.i !== gkRestante && r.vivo.k === kg + 1 && !(r.vivo.sem || []).includes(gkRestante), `ninguém pode: o goleiro é pulado (abriu k ${r.vivo.k}, esperado ${kg + 1})`);
});

/* ===================================================== L6 fim ===================================================== */
bloco("L6", "fim: 11 que cabem, 1 goleiro, o completar só com os de fora", (ok, nota) => {
  let leiloes = 0, completados = 0;
  const cenarios = [];
  for (const ed of ["public", "pro"]) for (const liga of ["br", "en", "br3", "jp", "py", "ch"]) for (const T of [2, 5, 8]) cenarios.push([ed, liga, T]);
  function confereFim(res, ctx, id) {
    const v = res.v, L = TMs.public.leilao;
    ok(v.fase === "fim", `${id}: não terminou`);
    for (let t = 0; t < ctx.T; t++) {
      const time = L.timeDe(v, ctx, t);
      ok(time.length === 11, `${id}: técnico ${t} com ${time.length}`);
      ok(time.filter(p => p.pos === "GK").length === 1, `${id}: técnico ${t} com ${time.filter(p => p.pos === "GK").length} goleiros`);
      ok(L.formacoesQueCabem(L.contaMascaras(time)).length > 0, `${id}: técnico ${t} não cabe em formação nenhuma`);
      ok(v.cx[t][1] === 0, `${id}: técnico ${t} com vaga no fim`);
    }
    const f = v.f || "", d = v.d;
    ok(f.length === ctx.fora.length, `${id}: f com ${f.length} (fora ${ctx.fora.length})`);
    const idsFora = new Set(ctx.fora.map(l => l.id));
    for (let j = 0; j < f.length; j++) if (f[j] !== "-") { completados++; ok(idsFora.has(ctx.fora[j].id), `${id}: completou com quem não é de fora`); }
    // ninguém dos lotes no completar, ninguém repetido
    const todos = [];
    for (let t = 0; t < ctx.T; t++) L.timeDe(v, ctx, t).forEach(p => todos.push(p.id));
    ok(new Set(todos).size === todos.length, `${id}: jogador em dois times`);
    ok(d.length === ctx.L, `${id}: d`);
  }
  for (const [ed, liga, T] of cenarios) {
    const ctx = ctxDe(ed, liga, T, "fim-" + liga);
    leiloes++;
    const res = leilaoRobos(ctx); res.erros.forEach(e => ok(false, `${ed}/${liga}/T${T}: ${e}`));
    confereFim(res, ctx, `${ed}/${liga}/T${T}`);
    // um "humano" que passa sempre: completa de graça no fim
    const resP = leilaoRobos(ctx, { humanos: [0], politica: (v, c, t) => (v.lider ?? -1) !== t && LE.pode(v, c, t).pode ? { acao: "passar", quando: v.abre + c.espera + 200 } : null });
    resP.erros.forEach(e => ok(false, `${ed}/${liga}/T${T} passivo: ${e}`));
    confereFim(resP, ctx, `${ed}/${liga}/T${T} passivo`);
    const doPassivo = (resP.v.f || "").split("").filter(c => c === "a").length;
    ok(doPassivo === 11, `${ed}/${liga}/T${T}: quem passou sempre completou ${doPassivo} de graça`);
    // um "humano" guloso: dá o lance mínimo em tudo o que a tela deixa (a tela confia no `pode`)
    const resG = leilaoRobos(ctx, { humanos: [1], politica: (v, c, t) => LE.pode(v, c, t).pode ? { acao: "lance", alvo: (v.valor || 0) + 1, quando: Math.max(v.abre + c.espera, v.t || 0) + 300 } : null });
    resG.erros.forEach(e => ok(false, `${ed}/${liga}/T${T} guloso: ${e}`));
    confereFim(resG, ctx, `${ed}/${liga}/T${T} guloso`);
    // todos passam sempre: todo mundo completa de graça (o completar de 11T)
    const resT = leilaoRobos(ctx, { humanos: Array.from({ length: T }, (_, i) => i), politica: (v, c, t) => LE.pode(v, c, t).pode ? { acao: "passar", quando: v.abre + c.espera + 100 + t } : null });
    resT.erros.forEach(e => ok(false, `${ed}/${liga}/T${T} todos passam: ${e}`));
    confereFim(resT, ctx, `${ed}/${liga}/T${T} todos passam`);
  }
  nota(`${leiloes * 4} leilões (robôs, um que passa, um guloso, todos passam); ${completados} jogadores completados de graça`);
});

/* ===================================================== L7 robôs ===================================================== */
bloco("L7", `robôs: ${N_LEILOES} leilões só de robôs`, (ok, nota) => {
  const r = rngT("L7");
  let completos = 0, recusas = 0, acimaMax = 0, precoSobe = 0, comQuartis = 0, minutos = 0, sobra = 0, tecs = 0, conf = 0;
  const amostra = [];
  for (let n = 0; n < N_LEILOES; n++) {
    const ed = r() < 0.5 ? "public" : "pro", liga = LIGAS[Math.floor(r() * LIGAS.length)], T = 2 + Math.floor(r() * 7);
    const ctx = ctxDe(ed, liga, T, "L7-" + n), res = leilaoRobos(ctx);
    if (res.erros.length) { recusas++; if (recusas <= 5) ok(false, `${ed}/${liga}/T${T}/L7-${n}: ${res.erros[0]}`); }
    if (res.v.fase === "fim" && !(res.v.f || "").replace(/-/g, "").length) completos++;
    minutos += res.minutos;
    res.v.cx.forEach(c => { sobra += c[0]; tecs++; });
    // nunca acima do máximo: cada lance contra o caixa do estado anterior
    for (let k = 1; k < res.estados.length; k++) {
      const a = res.estados[k - 1], b = res.estados[k];
      if (b.seq === a.seq && (b.n || 0) > (a.n || 0) && b.valor > LE.maximo(a, ctx, b.lider)) acimaMax++;
      if (n < 60) { const c = LE.conferir(a, b, ctx); if (!c.ok) { conf++; if (conf <= 3) ok(false, `conferência acusou um leilão honesto: ${c.motivo} (${liga}/T${T}/L7-${n}, passo ${k})`); } }
    }
    // o preço cresce com a nota: o quartil de cima custa mais que o de baixo
    const vs = res.vendas.map(x => ({ ov: ctx.lotes[x.i].overall, p: x.preco })).sort((a, b) => b.ov - a.ov);
    if (vs.length >= 8) {
      const q = Math.floor(vs.length / 4), media = a => a.reduce((s, x) => s + x.p, 0) / a.length;
      comQuartis++;
      if (media(vs.slice(0, q)) > media(vs.slice(-q))) precoSobe++;
    }
    if (n < 20) amostra.push({ ctx, res });
  }
  const pc = completos / N_LEILOES, ps = precoSobe / Math.max(1, comQuartis);
  ok(pc >= 0.99, `completam sem a reposição: ${(pc * 100).toFixed(1)}% (meta ≥ 99%)`);
  ok(acimaMax === 0, `${acimaMax} lances acima do máximo`);
  ok(ps >= 0.9, `o quartil de cima custa mais em ${(ps * 100).toFixed(1)}% dos leilões (meta ≥ 90%)`);
  // a mesma semente dá o mesmo leilão
  for (const { ctx, res } of amostra.slice(0, 10)) {
    const ctx2 = LE.contexto({ T: ctx.T, lotes: ctx.lotes, fora: ctx.fora, semente: ctx.semente });
    ok(jsonIgual(leilaoRobos(ctx2).vendas, res.vendas), `mesma semente, outro leilão (${ctx.semente})`);
  }
  // dois robôs com o MESMO perfil não repetem a sequência (o sorteio leva o técnico)
  {
    const ctx = amostra[0].ctx, estados = amostra[0].res.estados.slice(0, 200);
    let iguais = 0, comparados = 0;
    const b0 = { t: 0, perfil: "equilibrado", agress: 1, formacao: "4-4-2" }, b1 = Object.assign({}, b0, { t: 1 });
    for (const v of estados) {
      if ((v.lider ?? -1) === 0 || (v.lider ?? -1) === 1) continue;
      const a0 = LE.robo(v, ctx, b0), a1 = LE.robo(v, ctx, b1);
      if (a0 && a1) { comparados++; if (a0.quando === a1.quando && a0.alvo === a1.alvo) iguais++; }
    }
    ok(comparados > 20 && iguais / comparados < 0.2, `dois robôs iguais repetem ${iguais} de ${comparados} ações`);
  }
  // o mesmo robô rodado por 3 "aparelhos" dá o mesmo leilão: cada um calcula e tenta a transação; quem chega
  // depois do estado mudar aborta (seq/n) e recalcula
  for (const { ctx, res } of amostra.slice(0, 5)) {
    const bots = []; for (let t = 0; t < ctx.T; t++) bots.push(LE.perfilRobo(ctx.semente, t));
    const ra = rngT("aparelhos-" + ctx.semente);
    let agora = 1000, v = LE.inicial(ctx, agora), passos = 0, abortos = 0;
    while (v.fase !== "fim" && passos++ < 20000) {
      // cada aparelho escolhe a próxima ação pelo estado que viu (todos viram o mesmo)
      const planos = [0, 1, 2].map(() => { let m = null; for (const b of bots) { const a = LE.robo(v, ctx, b); if (a && (!m || a.quando < m.a.quando)) m = { a, b }; } return m; });
      const fim = LE.fimDoLote(v, ctx), p = planos[0];
      if (p && p.a.quando < fim) {
        agora = Math.max(agora, p.a.quando);
        // os 3 tentam em ordem sorteada, com o seq/n que viram
        const ordemAp = [0, 1, 2].sort(() => ra() - 0.5);
        const seqV = v.seq, nV = v.n || 0;
        let atual = v;
        for (const ap of ordemAp) {
          const rr = LE.aplicarRobo(atual, ctx, planos[ap].b, seqV, nV, agora);
          if (rr.ok) atual = rr.vivo; else abortos++;
        }
        if (atual.seq === v.seq && LE.todosPassaram(atual, ctx)) atual = LE.fechar(atual, ctx, atual.seq, agora).vivo;
        v = atual;
      } else {
        agora = Math.max(agora, fim);
        // os 3 tentam fechar; só o 1º consegue
        let atual = v;
        for (let ap = 0; ap < 3; ap++) { const rr = LE.fechar(atual, ctx, v.seq, agora); if (rr.ok) atual = rr.vivo; else abortos++; }
        v = atual;
      }
    }
    const final = d => d.v ? d.v.d + "|" + JSON.stringify(d.v.cx) : "";
    ok(final({ v }) === final(res), `3 aparelhos, outro leilão (${ctx.semente})`);
    ok(abortos > 0, "3 aparelhos sem nenhuma transação abortada (o teste não testou nada)");
  }
  ok(conf === 0, `conferência acusou ${conf} transições honestas`);
  nota(`${(pc * 100).toFixed(1)}% completos sem a reposição; quartil de cima mais caro em ${(ps * 100).toFixed(0)}%; ~${(minutos / N_LEILOES).toFixed(1)} min de leilão em média; sobra média R$ ${(sobra / tecs).toFixed(0)} por técnico`);
});

/* ===================================================== L8 protocolo (a sessão) ===================================================== */
// o relógio e a agenda de mentira: a hora só anda de um acontecimento para o próximo (o leilão inteiro em segundos)
function relogioVirtual(inicio) {
  const V = { hora: inicio || 1_000_000, fila: [], id: 0 };
  V.relogio = () => V.hora;
  V.agendar = (fn, ms) => { const e = { at: V.hora + Math.max(0, +ms || 0), fn, id: ++V.id, morto: false }; V.fila.push(e); return e; };
  V.cancelar = e => { if (e) e.morto = true; };
  // roda até pare() ou a agenda esvaziar; entre um acontecimento e outro, todas as promessas pendentes
  V.anda = async (pare, max = 400000) => {
    for (let k = 0; k < max; k++) {
      await new Promise(r => setImmediate(r));
      if (pare && pare()) return true;
      V.fila = V.fila.filter(e => !e.morto);
      if (!V.fila.length) return !!(pare && pare());
      let m = 0;
      for (let i = 1; i < V.fila.length; i++) { const a = V.fila[i], b = V.fila[m]; if (a.at < b.at || (a.at === b.at && a.id < b.id)) m = i; }
      const e = V.fila.splice(m, 1)[0];
      V.hora = Math.max(V.hora, e.at);
      e.fn();
    }
    return false;
  };
  // espera uma promessa que depende da agenda (a latência da rede): anda até ela resolver
  V.espera = async p => { let feito = false; p.then(() => { feito = true; }, () => { feito = true; }); await V.anda(() => feito); return p; };
  return V;
}
function armazemFalso(guardado) {
  const g = guardado || {};
  return { g, ler: (k, p) => (k in g ? JSON.parse(g[k]) : p), gravar: (k, v) => { g[k] = JSON.stringify(v); }, apagar: k => { delete g[k]; } };
}
// o "humano" de teste: decide como um robô com o perfil do técnico 0 e age pela API da sessão (lance/passar), meio
// milissegundo depois do robô que empataria com ele (na máquina pura o robô ganha o empate)
function piloto(S, V, Lx) {
  const perfil = Lx.perfilRobo(S.ctx.semente, S.eu);
  let pend = null, chave = null, parado = false, acoes = 0;
  const olha = () => {
    const v = S.vivoN;
    if (parado || !v || v.fase === "fim" || !S.sala || S.sala.meta.estado !== "leilao") { if (pend) V.cancelar(pend); pend = null; return; }
    const k = v.seq + ":" + v.n + ":" + v.p;
    if (k === chave) return;
    chave = k;
    if (pend) V.cancelar(pend);
    pend = null;
    const a = Lx.robo(v, S.ctx, perfil);
    if (!a) return;
    pend = V.agendar(() => { pend = null; acoes++; if (a.acao === "lance") S.lance(a.alvo); else S.passar(); }, a.quando + 0.5 - S.hora());
  };
  const off = S.aoMudar(olha);
  olha();
  return { parar() { parado = true; off(); if (pend) V.cancelar(pend); }, acoes: () => acoes };
}
function politicaPiloto(Lx, semente) {
  const perfil = Lx.perfilRobo(semente, 0);
  return (v, c, t) => { const a = Lx.robo(v, c, perfil); return a && Object.assign({}, a, { quando: a.quando + 0.5 }); };
}
// conta as transações que cada aparelho tentou e as que abortaram (para provar que houve disputa)
function contaTransacoes(rede) {
  const c = { tentou: 0, abortou: 0 }, orig = rede.transacao;
  rede.transacao = (cam, fn) => { c.tentou++; return orig(cam, fn).then(r => { if (!r.feito) c.abortou++; return r; }); };
  return c;
}
function resumoFinal(v) { return v ? JSON.stringify({ d: v.d, cx: v.cx, f: v.f || "", sem: v.sem || [] }) : "sem vivo"; }
function vendasDaRede(arv) {
  const out = [], vd = arv && arv.vendas;
  if (vd) Object.keys(vd).forEach(k => { if (vd[k]) out.push({ i: +k, t: vd[k].t, preco: vd[k].v }); });
  return out.sort((a, b) => a.i - b.i);
}
async function blocoAsync(nome, titulo, fn) {
  if (SO && !SO.includes(nome)) return;
  const t0 = performance.now(), erros = [], notas = [];
  const ok = (c, msg) => { if (!c) erros.push(msg); return !!c; };
  try { await fn(ok, s => notas.push(s)); } catch (e) { erros.push("exceção: " + (e && e.stack || e)); }
  const ms = performance.now() - t0;
  console.log(`${erros.length ? "REPROVOU" : "ok      "} ${nome.padEnd(4)} ${titulo}${notas.length ? " — " + notas.join("; ") : ""} (${(ms / 1000).toFixed(1)} s)`);
  if (erros.length) {
    falhas++;
    erros.slice(0, VERBOSO ? 200 : 8).forEach(e => console.log("         · " + e));
    if (erros.length > 8 && !VERBOSO) console.log(`         · … mais ${erros.length - 8}`);
  }
  resultados.push({ nome, ok: !erros.length });
}
// confere um fim de leilão visto por uma sessão: 11 que cabem para todos, o vivo de cada aparelho = o do banco
function confereFimSessao(ok, S, id) {
  const Lx = TMs.public.leilao, v = S.vivoN, ctx = S.ctx;
  ok(v && v.fase === "fim", `${id}: não chegou ao fim`);
  if (!v) return;
  for (let t = 0; t < ctx.T; t++) {
    const time = Lx.timeDe(v, ctx, t);
    ok(time.length === 11 && Lx.formacoesQueCabem(Lx.contaMascaras(time)).length > 0, `${id}: técnico ${t} com ${time.length} que ${Lx.formacoesQueCabem(Lx.contaMascaras(time)).length ? "" : "não "}cabem`);
    const e = S.escalacao(t);
    ok(e && e.tit.length === 11 && e.tit.every(k => k >= 0) && e.n === 11, `${id}: escalação do técnico ${t} incompleta: ${JSON.stringify(e && e.tit)}`);
  }
  ok(!S.alterada, `${id}: a conferência acusou a sala honesta (${S.alterada})`);
}

// anda o relógio virtual até a hora h (os acontecimentos antes dela acontecem)
// (na hora da sessão S, que pode estar acelerada ou deslocada da hora da agenda)
async function ate(V, h, S) {
  const agora = () => (S ? S.hora() : V.hora), f = S && S._fator ? S._fator() : 1;
  if (h > agora()) V.agendar(() => {}, (h - agora()) / f);
  await V.anda(() => agora() >= h);
}

async function testeSessao() {
  await blocoAsync("S", "sessão: identidades, botões e motivos, Tudo, antes/fechado, formação, escalação, Pronto, pausa, Minhas salas", async (ok, nota) => {
    const TMx = TMs.public, SS = TMx.leilaoSessao, Lx = TMx.leilao, U = TMx.ut._i, mundo = MUNDO.public;
    // --- identidades: 7 bots com nomes e clubes fictícios, cores sem repetir (nem a do humano), escudo desenhado
    {
      const V = relogioVirtual(), arm = armazemFalso();
      const A = await V.espera(SS.criarTreino({ liga: "br", bots: 7, semente: "S-ident", codigo: "SIDENT", mundo, relogio: V.relogio, agendar: V.agendar, cancelar: V.cancelar, armazem: arm, semAtual: true,
        clube: { nome: "Um Nome de Clube Muito Comprido", sigla: "abcd", cor: "#EF4444", escudo: "diamante|crown" } }));
      const tv = A.ver().tecnicos;
      ok(tv.length === 8 && A.eu === 0 && tv[0].eu && !tv[0].bot && tv.slice(1).every(t => t.bot), "8 técnicos, o humano no 0 e 7 bots");
      ok(tv[0].clube.nome === "Um Nome de Clube" && tv[0].clube.sigla === "ABC" && tv[0].clube.cor === "#ef4444" && tv[0].clube.escudo === "diamante|crown", "o clube do humano limpo: " + JSON.stringify(tv[0].clube));
      const nomes = tv.slice(1).map(t => t.nome), clubes = tv.slice(1).map(t => t.clube.nome), cores = tv.map(t => t.clube.cor.toLowerCase());
      ok(nomes.every(n => /^Bot [A-ZÀ-Ú][a-zà-ú]+$/.test(n)) && new Set(nomes).size === 7, "nomes dos bots: " + nomes.join(", "));
      ok(clubes.every(c => SS.CLUBES_BOT.some(x => x[0] === c)) && new Set(clubes).size === 7, "clubes dos bots: " + clubes.join(", "));
      ok(new Set(cores).size === 8, "cores repetidas: " + cores.join(" "));
      ok(tv.every(t => { const c = U.escudoCfg({ escudo: t.clube.escudo }); return c.forma + "|" + c.simb === t.clube.escudo && U.FORMAS[c.forma] && U.SIMBOLOS.includes(c.simb) && t.clube.nome.length <= 16 && /^[A-Z0-9À-Ú]{1,3}$/.test(t.clube.sigla); }), "escudos: " + tv.map(t => t.clube.escudo).join(" "));
      // os nomes pelo perfil (Arrojado/Ousado… para quem compra estrelas)
      // o nome vem do perfil (Arrojado/Ousado… para quem compra estrelas); um nome avulso só com os do perfil já usados
      ok(tv.slice(1).every(t => { const lst = SS.NOMES_BOT[Lx.perfilRobo("S-ident", t.t).perfil]; return lst.includes(t.nome) || lst.every(n => nomes.slice(0, t.t - 1).includes(n)); }),
        "nome × perfil: " + tv.slice(1).map(t => t.nome + "/" + Lx.perfilRobo("S-ident", t.t).perfil).join(", "));
      const B = await V.espera(SS.criarTreino({ liga: "br", bots: 3, semente: "S-ident2", codigo: "SIDEN2", mundo, relogio: V.relogio, agendar: V.agendar, cancelar: V.cancelar, armazem: arm, semAtual: true }));
      ok(jsonIgual(B.ver().tecnicos[0].clube, { nome: "Meu Clube", sigla: "MEU", cor: "#22c55e", escudo: "classico|tm-bola" }), "sem o Ultimate, o clube padrão: " + JSON.stringify(B.ver().tecnicos[0].clube));
      A.parar(); B.parar();
    }
    // --- botões, motivos e respostas do lance (3 técnicos; a pessoa com latência de 40 ms, o "outro aparelho" sem)
    {
      const V = relogioVirtual(), arm = armazemFalso();
      const A = await V.espera(SS.criarTreino({ liga: "en", bots: 2, semente: "S-botoes", codigo: "SBOTAO", mundo, relogio: V.relogio, agendar: V.agendar, cancelar: V.cancelar, armazem: arm, latencia: 40, semAtual: true }));
      const outro = A.rede.outroCliente({ latencia: 0 }), ctx = A.ctx;
      const lanceDe = (t, alvo) => V.espera(outro.transacao("vivo", cur => { const r = Lx.lance(cur, ctx, t, alvo, cur.seq, outro.horaServidor()); return r.ok ? r.vivo : undefined; }));
      await V.anda(() => !!A.vivoN);
      let w = A.ver();
      ok(w.lote && w.lote.pausa && w.botoes["+1"].motivo === "pausa" && !w.botoes.passar.pode, "na pausa entre lotes, os botões desligados: " + JSON.stringify(w.botoes && w.botoes["+1"]));
      ok(w.lote && w.lote.ordem === 1 && w.lote.total === 39 && w.lote.retrato && w.lote.dur === 10000 && w.proximos.length === 5, "o lote 1 de 39 com o retrato, 10 s e os 5 próximos");
      await ate(V, w.lote.liberado + 10, A);
      w = A.ver();
      ok(w.botoes["+1"].pode && w.botoes["+1"].alvo === 1 && w.botoes["+5"].alvo === 5 && w.botoes["+10"].alvo === 10 && w.botoes.tudo.alvo === 90 && w.botoes.outro.min === 1 && w.botoes.outro.max === 90 && w.botoes.passar.pode, "os alvos sobre o valor visto (0) e o Tudo R$ 90: " + JSON.stringify(w.botoes));
      let r = await V.espera(A.lance("+1"));
      w = A.ver();
      ok(r.ok && r.estado === "aceito" && w.lote.lider === 0 && w.lote.valor === 1, "o +1 aceito: " + JSON.stringify(r));
      ok(w.botoes["+1"].motivo === "lider" && !w.botoes.passar.pode && w.tecnicos[0].lider, "quem lidera não dá lance nem passa");
      await lanceDe(1, 2);
      // a pessoa toca no +1 (vê R$ 2) e o técnico 2 chega antes com R$ 3
      const pa = A.lance("+1"); await lanceDe(2, 3); r = await V.espera(pa);
      ok(!r.ok && r.estado === "antes" && r.valor === 3 && A.ver().lote.lider === 2, "alguém chegou antes: " + JSON.stringify(r));
      // o +5 também é sobre o valor VISTO: com um lance no meio, aborta (nunca sobe sozinho, mesmo cobrindo o novo)
      const pb = A.lance("+5"); await lanceDe(1, 4); r = await V.espera(pb);
      ok(!r.ok && r.estado === "antes" && r.valor === 4 && A.ver().lote.lider === 1, "o +5 com um lance no meio: " + JSON.stringify(r));
      r = await V.espera(A.lance(1000)); ok(!r.ok && r.motivo === "max" && r.max === 90, "outro valor acima do máximo: " + JSON.stringify(r));
      r = await V.espera(A.lance(4)); ok(!r.ok && r.motivo === "valor", "outro valor que não passa do atual: " + JSON.stringify(r));
      const vendidos = []; A.on("vendido", x => vendidos.push(x));
      r = await V.espera(A.lance("tudo"));
      ok(r.ok && r.valor === 90, "o Tudo: " + JSON.stringify(r));
      await V.anda(() => A.vivoN.seq > w.lote.seq);   // ninguém cobre R$ 90: todos passaram, fecha na hora
      w = A.ver();
      ok(vendidos.length === 1 && vendidos[0].t === 0 && vendidos[0].preco === 90 && vendidos[0].eu, "vendido para a pessoa por R$ 90: " + JSON.stringify(vendidos));
      ok(w.tecnicos[0].saldo === 10 && w.tecnicos[0].vagas === 10 && w.tecnicos[0].max === 1 && w.ultimo && w.ultimo.tipo === "vendido", "o caixa depois do Tudo: " + JSON.stringify(w.tecnicos[0]));
      ok(w.meu.time.length === 1 && w.meu.escalacao.n === 1 && w.meu.escalacao.tit.filter(k => k >= 0).length === 1, "o comprado no campinho");
      await V.anda(() => A.vendas[vendidos[0].i]);
      ok(A.ver().vendas.some(x => x.i === vendidos[0].i && x.t === 0 && x.preco === 90), "a venda registrada (vendas)");
      // o próximo lote: passar; depois o lance chega com o lote já fechado
      await ate(V, A.ver().lote.liberado + 10, A);
      if (A.ver().botoes.passar.pode) {
        r = await V.espera(A.passar());
        ok(r.ok && A.ver().botoes["+1"].motivo === "passou" && A.ver().tecnicos[0].passou, "passar: " + JSON.stringify(r));
      } else ok(false, "não pôde passar: " + JSON.stringify(A.ver().botoes.passar));
      await V.anda(() => A.ver().lote && !A.ver().lote.pausa && A.ver().botoes["+1"].pode);
      const pf = A.lance("+1");
      await V.espera(outro.transacao("vivo", cur => Lx.fechar(cur, ctx, cur.seq, Lx.fimDoLote(cur, ctx)).vivo));
      r = await V.espera(pf);
      ok(!r.ok && r.estado === "fechado", "o lance que chega com o lote fechado: " + JSON.stringify(r));
      // textos dos motivos (as telas mostram)
      ok(SS.textoMotivo("max", { max: 90 }) === "Acima do seu máximo R$ 90" && SS.textoMotivo("goleiro") === "Você já tem goleiro" && SS.textoMotivo("antes", { valor: 7 }) === "Alguém chegou antes: R$ 7", "textoMotivo");
      // pausa e aceleração do relógio do treino (ganchos)
      const h0 = A.hora(); A.pausar(); V.hora += 5000;
      ok(A.hora() === h0 && A.pausado(), "pausado, o relógio do treino não anda");
      const seqP = A.vivoN.seq; await V.anda(null, 30);
      ok(A.vivoN.seq === seqP, "pausado, nada acontece");
      A.retomar(); A.acelerar(10); const h1 = A.hora(); V.hora += 100;
      ok(Math.abs(A.hora() - h1 - 1000) < 1e-6, "acelerado 10×: " + (A.hora() - h1));
      A.acelerar(1);
      A.parar();
    }
    // --- formação e escalação: a preferida que deixa de caber muda sozinha (com aviso); trocar; Pronto → campeonato
    {
      // a preferida: uma em que o time que a pessoa vai ganhar de graça NÃO cabe (pela máquina pura, sem lances dela)
      const ctxE = Lx.contexto(Object.assign({ T: 4, semente: "S-esc" }, Lx.criarLotes(mundo, "en", 4)));
      const puraE = leilaoRobos(ctxE, { LE: Lx, humanos: [0], politica: () => null });
      const cabemE = Lx.formacoesQueCabem(Lx.contaMascaras(Lx.timeDe(puraE.v, ctxE, 0)));
      const pref = Lx.FORMACOES.find(f => !cabemE.includes(f)) || "4-2-4";
      const V = relogioVirtual(), arm = armazemFalso();
      const A = await V.espera(SS.criarTreino({ liga: "en", bots: 3, formacao: pref, semente: "S-esc", codigo: "SESCAL", mundo, relogio: V.relogio, agendar: V.agendar, cancelar: V.cancelar, armazem: arm, semAtual: true }));
      const avisos = [], estados = []; A.on("formacao", x => avisos.push(x)); A.on("estado", x => estados.push(x.estado));
      await V.anda(() => !!A.vivoN);
      let r = await V.espera(A.trocar(0, 1)); ok(!r.ok && r.motivo === "incompleto", "trocar com o time incompleto: " + JSON.stringify(r));
      r = await V.espera(A.mudarFormacao("4-3-3")); ok(r.ok && A.escalacao(0).formacao === "4-3-3", "mudar a formação no começo");
      r = await V.espera(A.mudarFormacao(pref)); ok(r.ok, "de volta à preferida " + pref);
      // a pessoa não dá lance: completa de graça no fim (com os melhores de fora, sem olhar a preferida)
      await V.anda(() => A.vivoN.fase === "fim");
      await V.anda(() => A.sala.meta.estado === "escalacao");
      const time = Lx.timeDe(A.vivoN, A.ctx, 0), cabem = Lx.formacoesQueCabem(Lx.contaMascaras(time));
      const e = A.escalacao(0);
      ok(cabem.includes(e.formacao) && e.n === 11 && e.tit.every(k => k >= 0), "a escalação no fim cabe: " + e.formacao + " em " + cabem);
      ok(jsonIgual(cabem, cabemE), "o time de graça ≠ o da máquina pura: " + cabem + " × " + cabemE);
      ok(!cabem.includes(pref) && avisos.length >= 1 && avisos[0].de === pref && avisos[avisos.length - 1].para === e.formacao && A.escal[0].formacao === e.formacao && e.pref === e.formacao && !e.aviso,
        `o ${pref} deixou de caber: o aviso e a formação nova (${JSON.stringify(avisos)}, escal ${JSON.stringify(A.escal[0])})`);
      const naoCabe = Lx.FORMACOES.find(f => !cabem.includes(f));
      if (naoCabe) { r = await V.espera(A.mudarFormacao(naoCabe)); ok(!r.ok && r.motivo === "naoCabe", "mudar para uma que não cabe: " + JSON.stringify(r)); }
      // trocar duas vagas do mesmo grupo vale; o goleiro com um zagueiro, não
      const slots = Lx.slotsDe(e.formacao), dfs = slots.map((s, i) => s[0] === "DF" ? i : -1).filter(i => i >= 0);
      r = await V.espera(A.trocar(dfs[0], dfs[1]));
      const e2 = A.escalacao(0);
      ok(r.ok && e2.manual && e2.tit[dfs[0]] === e.tit[dfs[1]] && e2.tit[dfs[1]] === e.tit[dfs[0]], "trocar dois zagueiros: " + JSON.stringify(r));
      r = await V.espera(A.trocar(0, dfs[0])); ok(!r.ok && r.motivo === "grupo", "o goleiro na vaga do zagueiro: " + JSON.stringify(r));
      // a formação nova desfaz a troca à mão (a automática da formação nova)
      const outra = cabem.find(f => f !== e.formacao);
      if (outra) { r = await V.espera(A.mudarFormacao(outra)); ok(r.ok && !A.escalacao(0).manual && A.escalacao(0).formacao === outra, "outra formação: a automática"); }
      // Pronto: com só uma pessoa, o campeonato abre na hora (sem esperar os 60 s)
      const hP = A.hora();
      r = await V.espera(A.prontoEscalacao(true));
      await V.anda(() => A.sala.meta.estado === "camp");
      ok(A.sala.meta.estado === "camp" && A.hora() - hP < 1000 && A.ver().meu.pronto, "Pronto leva ao campeonato: " + A.sala.meta.estado + " em " + (A.hora() - hP) + " ms");
      ok(jsonIgual(estados, ["escalacao", "camp"]), "estados da sala: " + estados);
      A.parar();
    }
    // --- só olhar (regras de outra versão), conferência e Minhas salas
    {
      const V = relogioVirtual(), arm = armazemFalso();
      const base = { relogio: V.relogio, agendar: V.agendar, cancelar: V.cancelar, armazem: arm, semAtual: true, mundo };
      const A = await V.espera(SS.criarTreino(Object.assign({ liga: "es", bots: 2, semente: "S-x", codigo: "SXAAAA" }, base)));
      await V.anda(() => A.vivoN && A.vivoN.seq >= 3);
      A.parar(); await V.anda(null, 30);
      // a sala gravada com outras regras: abre só para olhar (nada anda)
      const g = JSON.parse(arm.g["leilao:sala:SXAAAA"]); g.sala.meta.regras = Lx.REGRAS + 1; arm.g["leilao:sala:SXAAAA"] = JSON.stringify(g);
      const O = await V.espera(SS.abrir("SXAAAA", base));
      const seqO = O.vivoN.seq; await V.anda(null, 40);
      const rO = await V.espera(O.lance("+1"));
      ok(O.soOlhar && O.vivoN.seq === seqO && !rO.ok && rO.motivo === "fase", "regras de outra versão: só olha");
      O.parar();
      g.sala.meta.regras = Lx.REGRAS; arm.g["leilao:sala:SXAAAA"] = JSON.stringify(g);
      // um vivo adulterado (o saldo que volta) congela a sessão
      const B = await V.espera(SS.abrir("SXAAAA", base)), alt = [];
      B.on("alterada", x => alt.push(x.motivo));
      const outro = B.rede.outroCliente();
      await V.espera(outro.transacao("vivo", cur => { cur.cx[1][0] = 150; return cur; }));
      const seqB = B.vivoN.seq; await V.anda(null, 40);
      ok(B.alterada && alt.length === 1 && B.vivoN.seq === seqB && !B.ver().botoes["+1"].pode, "o vivo adulterado congela: " + B.alterada);
      B.parar();
      // Minhas salas: até 3 treinos guardados (o 4º tira o mais antigo)
      for (const c of ["SXBBBB", "SXCCCC", "SXDDDD"]) { const X = await V.espera(SS.criarTreino(Object.assign({ liga: "de", bots: 1, semente: c, codigo: c }, base))); await V.anda(null, 5); X.parar(); V.hora += 1000; }
      await V.anda(null, 30);
      const ls = SS.salas({ armazem: arm });
      ok(jsonIgual(ls.map(x => x.codigo), ["SXDDDD", "SXCCCC", "SXBBBB"]) && ls.every(x => x.treino && x.T === 2 && x.estado === "leilao" && x.regrasOk && x.clube), "Minhas salas: " + JSON.stringify(ls.map(x => [x.codigo, x.estado, x.T])));
      ok(!arm.g["leilao:sala:SXAAAA"], "o 4º treino não tirou o mais antigo");
    }
    nota("identidades, Tudo de R$ 90, antes/fechado/max/valor, passar, formação com aviso, trocar, Pronto, pausa, aceleração, só olhar, conferência, Minhas salas");
  });
}

async function testeProtocolo() {
  await blocoAsync("L8", "protocolo: o leilão inteiro pela sessão e pela rede em memória = a máquina pura", async (ok, nota) => {
    const TMx = TMs.public, SS = TMx.leilaoSessao, Lx = TMx.leilao, mundo = MUNDO.public;
    const ligas = [["en", 5], ["br", 3], ["it", 7]];
    let cenarios = 0, abortos = 0, transacoes = 0, lances = 0;
    for (const [liga, bots] of ligas) {
      const sem = "L8-" + liga, cod = "L8" + liga.toUpperCase();
      // a máquina pura com o mesmo "humano"
      const ctxP = Lx.contexto(Object.assign({ T: bots + 1, semente: sem }, (() => { const r = Lx.criarLotes(mundo, liga, bots + 1); return { lotes: r.lotes, fora: r.fora }; })()));
      const pura = leilaoRobos(ctxP, { LE: Lx, humanos: [0], politica: politicaPiloto(Lx, sem) });
      ok(!pura.erros.length, `${liga}: a máquina pura: ${pura.erros[0]}`);
      const esperado = resumoFinal(pura.v);
      const vendasPuras = pura.vendas.slice().sort((a, b) => a.i - b.i);

      // (a) 1 aparelho (o treino no celular), latência 40 ms; (b) 3 aparelhos escalonados (0; 1,5; 3 s); (c) 3 ao mesmo
      // tempo; (d) latências sorteadas de 0 a 150 ms com 3 ao mesmo tempo (só os invariantes); (e) o 1º aparelho cai no
      // meio (os outros seguem; invariantes)
      for (const cen of ["a", "b", "c", "d", "e"]) {
        cenarios++;
        const V = relogioVirtual(), arm = armazemFalso(), id = `${liga}/T${bots + 1}/${cen}`;
        const rs = TMx.rng.make(TMx.rng.hashStr("lat:" + id));
        const lat = cen === "d" ? () => Math.floor(rs() * 151) : 40;
        const A = await V.espera(SS.criarTreino({ liga, bots, formacao: "4-4-2", semente: sem, codigo: cod + cen, mundo, relogio: V.relogio, agendar: V.agendar, cancelar: V.cancelar, armazem: arm, latencia: lat, semAtual: true }));
        const sessoes = [A], contas = [contaTransacoes(A.rede)];
        if (cen !== "a") {
          for (const k of [1, 2]) {
            const rede = A.rede.outroCliente({ latencia: lat });
            contas.push(contaTransacoes(rede));
            sessoes.push(await V.espera(SS.abrir(A.codigo, { rede, eu: -1, atraso: cen === "b" || cen === "e" ? 1500 * k : 0, agendar: V.agendar, cancelar: V.cancelar, semAtual: true })));
          }
        }
        const pil = piloto(A, V, Lx);
        if (cen === "e") {
          // o 1º aparelho (com o "humano") cai quando o leilão passa da metade
          await V.anda(() => A.vivoN && A.vivoN.seq >= Math.floor(ctxP.fila.length / 2));
          pil.parar(); A.parar();
        }
        const fim = sessoes[sessoes.length - 1];
        const chegou = await V.anda(() => fim.vivoN && fim.vivoN.fase === "fim" && sessoes.every(S => S.parado || (S.vivoN && S.vivoN.fase === "fim")));
        ok(chegou, `${id}: o leilão não terminou (seq ${fim.vivoN && fim.vivoN.seq})`);
        // a sala passa à escalação e, com 60 s (ninguém marcou "Pronto"), ao campeonato
        await V.anda(() => fim.sala && fim.sala.meta.estado === "camp");
        ok(fim.sala && fim.sala.meta.estado === "camp", `${id}: a sala não passou à escalação e ao campeonato (${fim.sala && fim.sala.meta.estado})`);
        const banco = A.rede._arvore();
        for (const S of sessoes) if (!S.parado) {
          confereFimSessao(ok, S, id);
          ok(resumoFinal(S.vivoN) === resumoFinal(Lx.norm(banco.vivo, S.ctx)), `${id}: o aparelho ${sessoes.indexOf(S)} viu outro fim`);
        }
        if (cen === "a" || cen === "b" || cen === "c") {
          ok(resumoFinal(Lx.norm(banco.vivo, A.ctx)) === esperado, `${id}: o leilão pela rede ≠ a máquina pura`);
          const vr = vendasDaRede(banco);
          ok(jsonIgual(vr, vendasPuras), `${id}: as vendas gravadas ≠ as da máquina pura (${vr.length} × ${vendasPuras.length}): ${JSON.stringify(vendasPuras.filter(x => !vr.some(y => jsonIgual(x, y))))} × ${JSON.stringify(vr.filter(x => !vendasPuras.some(y => jsonIgual(x, y))))}`);
        }
        // ao mesmo tempo, os outros aparelhos disputam (e abortam); escalonados, quase não tentam (o 1º já agiu)
        const tentOutros = contas.slice(1).reduce((s, c) => s + c.tentou, 0), abOutros = contas.slice(1).reduce((s, c) => s + c.abortou, 0);
        if (cen === "c") ok(abOutros > 0, `${id}: nenhuma transação dos outros aparelhos abortou (o teste não testou a disputa)`);
        if (cen === "b") ok(tentOutros <= 0.05 * contas[0].tentou, `${id}: escalonados, os outros aparelhos tentaram ${tentOutros} transações (o 1º, ${contas[0].tentou})`);
        abortos += abOutros;
        transacoes += contas.reduce((s, c) => s + c.tentou, 0);
        lances += pil.acoes();
        ok(pil.acoes() > 0, `${id}: o "humano" não agiu`);
        sessoes.forEach(S => S.parar());
        pil.parar();
      }

      // (f) recarregar a página no meio: o mesmo estado, o mesmo tempo que faltava, e o fim = a máquina pura
      {
        cenarios++;
        const V = relogioVirtual(), arm = armazemFalso(), id = `${liga}/T${bots + 1}/recarregar`;
        const base = { relogio: V.relogio, agendar: V.agendar, cancelar: V.cancelar, armazem: arm, latencia: 40, semAtual: true };
        const A = await V.espera(SS.criarTreino(Object.assign({ liga, bots, formacao: "4-4-2", semente: sem, codigo: cod + "F", mundo }, base)));
        let pil = piloto(A, V, Lx);
        // para no meio de um lote com lance (tempo correndo)
        await V.anda(() => A.vivoN && A.vivoN.seq >= 12 && (A.vivoN.n || 0) >= 1 && A.hora() > A.vivoN.t + 300);
        const horaAntes = A.hora();
        pil.parar(); A.parar();
        // o que já estava a caminho da rede termina (no treino a "rede" é a própria página) e vai para o aparelho
        await V.anda(null, 60);
        const gravado = JSON.parse(arm.g["leilao:sala:" + A.codigo]), vivoGravado = JSON.stringify(gravado.vivo);
        const hEsperada = Math.max(gravado.relogio || 0, gravado.vivo.abre || 0, gravado.vivo.t || 0);
        const fimG = Lx.fimDoLote(gravado.vivo, A.ctx), restanteG = fimG - Math.max(hEsperada, gravado.vivo.abre + A.ctx.espera);
        V.hora += 10 * 60000;                          // a página ficou fechada 10 min: o relógio do treino não anda
        const B = await V.espera(SS.abrir(A.codigo, base));
        ok(JSON.stringify(B.vivo) === vivoGravado, `${id}: depois de recarregar, outro vivo`);
        ok(Math.abs(B.hora() - hEsperada) < 1 && B.hora() - horaAntes < 100, `${id}: o relógio do treino andou com a página fechada (${B.hora() - horaAntes} ms)`);
        const depois = B.ver();
        ok(depois.lote && depois.lote.i === gravado.vivo.i && Math.abs(depois.lote.restante - restanteG) < 1 && restanteG > 0, `${id}: o lote voltou com outro tempo (${restanteG} → ${depois.lote && depois.lote.restante})`);
        ok(B.eu === 0 && depois.tecnicos.length === bots + 1, `${id}: voltou como outro técnico`);
        pil = piloto(B, V, Lx);
        await V.anda(() => B.vivoN && B.vivoN.fase === "fim");
        confereFimSessao(ok, B, id);
        ok(resumoFinal(B.vivoN) === esperado, `${id}: recarregando no meio, o leilão ≠ a máquina pura`);
        pil.parar();
        // sair da sala apaga o treino do aparelho (e nada grava de novo depois)
        await V.espera(B.sair());
        await V.anda(null, 50);
        ok(!Object.keys(arm.g).some(k => k.indexOf("leilao:sala:") === 0) && !(arm.g["leilao:salas"] && JSON.parse(arm.g["leilao:salas"]).length), `${id}: sair da sala não apagou o treino: ${Object.keys(arm.g)}`);
      }
    }
    nota(`${cenarios} leilões pela sessão (${ligas.map(x => x[0] + "/T" + (x[1] + 1)).join(", ")}; 1 aparelho, 3 escalonados, 3 ao mesmo tempo, latências sorteadas, o 1º aparelho caindo, recarregar no meio); ${transacoes} transações, ${abortos} abortadas pela disputa; ${lances} ações do "humano"`);
  });
}

/* ===================================================== L9 formações ===================================================== */
bloco("L9", "formações e escalação: os grupos do jogador, nunca dois goleiros, as vagas do TM, o encaixe de menor custo", (ok, nota) => {
  const F = TMs.public.comp.FORMATIONS;
  for (const f of LE.FORMACOES) {
    ok(!!F[f], `${f} não existe em TM.comp.FORMATIONS`);
    if (!F[f]) continue;
    const c = [0, 0, 0, 0]; F[f].forEach(s => c[GR.indexOf(s[0])]++);
    ok(jsonIgual(c, LE.VAGAS_FORM[f]), `${f}: vagas ${JSON.stringify(LE.VAGAS_FORM[f])} × ${JSON.stringify(c)} no TM`);
  }
  const J = (pos, grupos) => ({ id: "x" + Math.random(), pos, grupos: grupos || [pos] });
  const base = [J("GK"), J("DF"), J("DF"), J("DF"), J("DF"), J("MF"), J("MF"), J("MF"), J("MF"), J("FW")];
  const cabe = time => LE.formacoesQueCabem(LE.contaMascaras(time));
  ok(jsonIgual(cabe(base.concat([J("MF", ["MF", "FW"])])), ["4-4-2"]), "o MEI/ATA cabe como atacante no 4-4-2: " + cabe(base.concat([J("MF", ["MF", "FW"])])));
  ok(cabe(base.concat([J("MF")])).length === 0, "um meia só meia não cabe (4 DF + 5 MF + 1 FW): " + cabe(base.concat([J("MF")])));
  ok(cabe([J("GK"), J("GK")]).length === 0, "dois goleiros cabem");
  ok(cabe([J("GK"), J("DF", ["DF", "MF"]), J("GK")]).length === 0, "dois goleiros (com outro no meio) cabem");
  ok(cabe([J("FW"), J("FW"), J("FW"), J("FW"), J("FW")]).length === 0, "5 atacantes puros cabem");
  ok(jsonIgual(cabe([J("FW"), J("FW"), J("FW"), J("FW")]), ["4-2-4"]), "4 atacantes: só o 4-2-4");
  // o encaixe de verdade
  const e = LE.encaixe(base.concat([J("MF", ["MF", "FW"])]), "4-4-2");
  ok(e && e[10] === 3 && e.filter(g => g === 3).length === 2 && e[0] === 0, "encaixe do MEI/ATA como atacante: " + JSON.stringify(e));
  ok(LE.encaixe(base.concat([J("MF")]), "4-4-2") === null, "encaixe impossível dá null");
  // a formação preferida muda sozinha para a que cabe e mais se parece
  ok(LE.formacaoPara("4-4-2", base) === "4-4-2", "a preferida que cabe fica");
  const tresAtac = [J("GK"), J("FW"), J("FW"), J("FW")];
  ok(LE.formacaoPara("4-4-2", tresAtac) === "4-3-3", "4-4-2 com 3 atacantes vira " + LE.formacaoPara("4-4-2", tresAtac));
  // empate na distância (4-3-3 e 3-4-3 estão a 4 do 5-4-1): vale a ordem da lista
  ok(LE.formacaoPara("5-4-1", tresAtac) === "4-3-3", "5-4-1 com 3 atacantes vira " + LE.formacaoPara("5-4-1", tresAtac));
  const quatroAtac = tresAtac.concat([J("FW")]);
  ok(LE.formacaoPara("5-4-1", quatroAtac) === "4-2-4", "5-4-1 com 4 atacantes vira " + LE.formacaoPara("5-4-1", quatroAtac));
  const cincoZag = [J("GK"), J("DF"), J("DF"), J("DF"), J("DF"), J("DF")];
  ok(LE.formacaoPara("4-3-3", cincoZag) === "5-4-1", "4-3-3 com 5 zagueiros vira " + LE.formacaoPara("4-3-3", cincoZag));
  ok(LE.formacaoPara("4-4-2", [J("GK"), J("GK")]) === null, "sem formação possível: null");
  // os grupos de verdade do TM: um MEI com o ATA (playerVersa) cabe como atacante
  const { lotes } = lotesDe("public", "br", 8);
  const meiAta = lotes.find(l => l.pos === "MF" && l.grupos.includes("FW"));
  ok(!!meiAta, "nenhum meia com o grupo dos atacantes nos lotes da br");
  if (meiAta) {
    ok(jsonIgual(meiAta.grupos, [meiAta.pos].concat(TMs.public.comp.playerVersa(MUNDO.public.playersById[meiAta.id]))), "grupos = pos + playerVersa");
    ok(jsonIgual(cabe(base.concat([meiAta])), ["4-4-2"]), "o MEI/ATA real cabe como atacante");
  }
  ok(lotes.filter(l => l.pos === "GK").every(l => jsonIgual(l.grupos, ["GK"])), "goleiro com outro grupo");
  ok(lotes.filter(l => l.pos !== "GK").every(l => !l.grupos.includes("GK")), "jogador de linha com o grupo dos goleiros");

  // a escalação: os 11 de cada time no fim, cada um numa vaga dos SEUS grupos, com o menor custo de função (−1/−2);
  // nenhuma troca de duas vagas baixa o custo (o encaixe é o ótimo) e o custo é o do specificPenalty do TM
  let times = 0, penTot = 0, comPen = 0, versaUsado = 0;
  for (const [liga, T] of [["br", 4], ["en", 8], ["jp", 3], ["it", 6]]) {
    const ctx = ctxDe("public", liga, T, "esc-" + liga), res = leilaoRobos(ctx);
    for (let t = 0; t < T; t++) {
      times++;
      const e = LE.escalacaoDe(res.v, ctx, t, null, "4-4-2"), slots = LE.slotsDe(e.formacao);
      const ok11 = e.n === 11 && e.tit.length === 11 && new Set(e.tit).size === 11 && e.tit.every(k => k >= 0);
      ok(ok11, `${liga}/T${T}/t${t}: escalação ${JSON.stringify(e.tit)}`);
      if (!ok11) continue;
      ok(e.formacao === LE.formacaoPara("4-4-2", LE.timeDe(res.v, ctx, t)), `${liga}/t${t}: formação ${e.formacao}`);
      const custo = tit => tit.reduce((s, k, i) => s + LE.custoVaga(LE.retratoDe(ctx, k), slots[i]), 0);
      const c0 = custo(e.tit);
      ok(c0 < LE.FORA_VAGA && c0 === e.pen.reduce((a, b) => a + b, 0), `${liga}/t${t}: custo ${c0} × pen ${e.pen}`);
      penTot += c0; if (c0) comPen++;
      e.tit.forEach((k, i) => { const r = LE.retratoDe(ctx, k); if (slots[i][0] !== r.pos) versaUsado++; ok(r.grupos.includes(slots[i][0]), `${liga}/t${t}: ${r.pos} ${r.grupos} na vaga ${slots[i][0]}`); });
      for (let a = 0; a < 11; a++) for (let b = a + 1; b < 11; b++) {
        const tt = e.tit.slice(); [tt[a], tt[b]] = [tt[b], tt[a]];
        if (custo(tt) < c0) { ok(false, `${liga}/t${t}: trocar ${a} e ${b} baixa o custo (${custo(tt)} < ${c0})`); a = 11; break; }
      }
      // o custo da vaga = o specificPenalty do TM com o jogador de verdade (sem gravar nada no retrato)
      const k0 = e.tit[5], r0 = LE.retratoDe(ctx, k0), p0 = MUNDO.public.playersById[r0.id];
      ok(LE.custoVaga(r0, slots[5]) === TMs.public.comp.specificPenalty(p0, slots[5]) && !("_versa" in r0), `${liga}/t${t}: custo da vaga ≠ specificPenalty (${r0.id})`);
      // trocar à mão: o goleiro com um de linha não; dois do mesmo grupo sim (e a manual vale enquanto for válida)
      const gk = slots.findIndex(sl => sl[0] === "GK"), df = slots.map((sl, i) => sl[0] === "DF" ? i : -1).filter(i => i >= 0);
      ok(LE.trocarVagas(e, ctx, gk, df[0]).erro === "grupo", `${liga}/t${t}: goleiro trocado com zagueiro`);
      const tr = LE.trocarVagas(e, ctx, df[0], df[1]);
      ok(tr.tit && tr.tit[df[0]] === e.tit[df[1]], `${liga}/t${t}: troca de zagueiros recusada (${tr.erro})`);
      const em = LE.escalacaoDe(res.v, ctx, t, { formacao: e.formacao, tit: tr.tit }, "4-4-2");
      ok(em.manual && jsonIgual(em.tit, tr.tit), `${liga}/t${t}: a escalação à mão não vale`);
      const ruim = tr.tit.slice(); ruim[gk] = tr.tit[df[0]]; ruim[df[0]] = tr.tit[gk];
      ok(!LE.escalacaoDe(res.v, ctx, t, { formacao: e.formacao, tit: ruim }, "4-4-2").manual, `${liga}/t${t}: a escalação à mão inválida valeu`);
    }
  }
  // o método húngaro contra a força bruta (matrizes pequenas sorteadas)
  {
    const r = rngT("hungaro");
    const perms = (m, n) => { const out = []; const rec = (pre, usados) => { if (pre.length === n) { out.push(pre.slice()); return; } for (let j = 0; j < m; j++) if (!usados[j]) { usados[j] = 1; pre.push(j); rec(pre, usados); pre.pop(); usados[j] = 0; } }; rec([], []); return out; };
    let errados = 0;
    for (let caso = 0; caso < 300; caso++) {
      const n = 1 + Math.floor(r() * 5), m = n + Math.floor(r() * 3);
      // vagas e jogadores de mentira com grupos sorteados: o custo pela própria escalacao (slots do 4-4-2 cortados)
      const a = []; for (let i = 0; i < n; i++) { a.push([]); for (let j = 0; j < m; j++) a[i].push(r() < 0.25 ? LE.FORA_VAGA : Math.floor(r() * 3)); }
      let melhor = Infinity; for (const p of perms(m, n)) { let c = 0; for (let i = 0; i < n; i++) c += a[i][p[i]]; melhor = Math.min(melhor, c); }
      const col = LE._hungaro(a, n, m); let c = 0; for (let i = 0; i < n; i++) c += a[i][col[i]];
      if (c !== melhor || new Set(col).size !== n) errados++;
    }
    ok(errados === 0, `o método húngaro errou ${errados} de 300 contra a força bruta`);
  }
  // time incompleto (durante o leilão): os que tem nas vagas, o resto vazio
  {
    const ctx = ctxDe("public", "br", 4, "esc-parcial"), res = leilaoRobos(ctx), meio = res.estados[Math.floor(res.estados.length / 2)];
    const e = LE.escalacaoDe(meio, ctx, 0, null, "4-4-2"), idx = LE.timeIdx(meio, ctx, 0);
    ok(e.n === idx.length && e.n < 11 && e.tit.filter(k => k >= 0).length === e.n && e.tit.filter(k => k < 0).length === 11 - e.n, `escalação com ${idx.length}: ${JSON.stringify(e.tit)}`);
  }
  nota(`${times} times escalados no ótimo (${comPen} com −1/−2, custo médio ${(penTot / Math.max(1, times)).toFixed(2)}; ${versaUsado} jogadores fora do grupo principal, em grupo seu)`);});

/* ===================================================== L10 conferência ===================================================== */
bloco("L10", "conferência: o vivo adulterado é acusado", (ok, nota) => {
  // um leilão honesto, com o ouvinte vendo todos os estados e pulando estados (1 de cada 2 e de cada 3)
  const ctx = ctxDe("public", "en", 6, "conferencia"), res = leilaoRobos(ctx), E = res.estados;
  let honestas = 0, acusadas = 0;
  for (const passo of [1, 2, 3]) for (let k = passo; k < E.length; k += passo) {
    honestas++;
    const c = LE.conferir(E[k - passo], E[k], ctx);
    if (!c.ok) { acusadas++; if (acusadas <= 3) ok(false, `honesto acusado (${passo}): ${c.motivo} no passo ${k}`); }
  }
  ok(LE.conferir(null, E[0], ctx).ok, "o vivo inicial");
  // pega um estado com lance e um fechamento com venda
  const kLance = E.findIndex((v, k) => k > 0 && v.seq === E[k - 1].seq && (v.n || 0) === (E[k - 1].n || 0) + 1 && v.valor >= 3);
  const kVenda = E.findIndex((v, k) => k > 0 && v.seq === E[k - 1].seq + 1 && (E[k - 1].lider ?? -1) >= 0);
  const cl = o => JSON.parse(JSON.stringify(o));
  const acusa = (a, b, nome) => { const c = LE.conferir(a, b, ctx); ok(!c.ok, `${nome}: não acusou`); if (VERBOSO) console.log("         " + nome + " → " + c.motivo); return c.motivo; };
  const motivos = [];
  if (kLance > 0) {
    const a = E[kLance - 1], b = cl(E[kLance]);
    // saldo que sobe
    const b1 = cl(b); b1.cx[0][0] += 5; motivos.push(acusa(a, b1, "saldo que sobe"));
    // lance acima do máximo
    const b2 = cl(b); b2.valor = LE.maximo(a, ctx, b2.lider) + 1; motivos.push(acusa(a, b2, "lance acima do máximo"));
    // lance que desce
    const b3 = cl(b); b3.valor = Math.max(1, (a.valor || 0)); b3.n = (a.n || 0) + 1; motivos.push(acusa(a, b3, "lance que não sobe"));
    // o lote trocado no meio
    const b4 = cl(b); b4.i = ctx.fila[ctx.fila.length - 1]; motivos.push(acusa(a, b4, "lote trocado"));
  } else ok(false, "sem estado com lance");
  if (kVenda > 0) {
    const a = E[kVenda - 1], b = E[kVenda], dono = a.lider;
    // venda sem dinheiro: o dono marcado e o caixa sem o desconto
    const b1 = cl(b); b1.cx[dono][0] = a.cx[dono][0]; motivos.push(acusa(a, b1, "venda sem descontar"));
    // venda por menos que o lance
    const b2 = cl(b); b2.cx[dono][0] = a.cx[dono][0] - a.valor + 1; motivos.push(acusa(a, b2, "venda por menos que o lance"));
    // venda para quem não deu lance (outro técnico, com o mesmo preço)
    const outro = (dono + 1) % ctx.T, b3 = cl(b);
    b3.d = b3.d.slice(0, a.i) + LE.letra(outro) + b3.d.slice(a.i + 1);
    b3.cx[dono] = a.cx[dono].slice(); b3.cx[outro][0] -= a.valor; b3.cx[outro][1] -= 1; b3.cx[outro][2 + GR.indexOf(ctx.lotes[a.i].pos)]++;
    motivos.push(acusa(a, b3, "venda para quem não liderava sem lance novo"));
    // saldo negativo (venda sem dinheiro de verdade)
    const b4 = cl(b); b4.cx[dono][0] = -3; motivos.push(acusa(a, b4, "saldo negativo"));
    // o dono de um lote vendido muda
    const vendido = b.d.split("").findIndex(c => c !== "-");
    const b5 = cl(b); const c0 = b5.d[vendido], c1 = c0 === "a" ? "b" : "a"; b5.d = b5.d.slice(0, vendido) + c1 + b5.d.slice(vendido + 1);
    motivos.push(acusa(a, b5, "o dono que muda"));
  } else ok(false, "sem fechamento com venda");
  // seq que volta (um estado de dois lotes atrás)
  const kx = Math.floor(E.length / 2), kv = E.findIndex(v => v.seq === E[kx].seq - 2);
  ok(kv >= 0, "sem estado de dois lotes atrás");
  if (kv >= 0) { const m = acusa(E[kx], E[kv], "seq que volta"); ok(m === "voltou", "seq que volta acusado como " + m); motivos.push(m); }
  ok(acusadas === 0, `${acusadas} de ${honestas} transições honestas acusadas`);
  nota(`${honestas} transições honestas (também com estados pulados), ${motivos.length} adulterações acusadas (${[...new Set(motivos)].join(", ")})`);
});

/* ===================================================== R rede em memória ===================================================== */
async function testeRede() {
  if (SO && !SO.includes("R")) return;
  const t0 = performance.now(), erros = [];
  const ok = (c, m) => { if (!c) erros.push(m); };
  const R = TMs.public.leilaoRede;
  const guardado = {};
  const armazem = { ler: (k, p) => (k in guardado ? JSON.parse(guardado[k]) : p), gravar: (k, v) => { guardado[k] = JSON.stringify(v); }, apagar: k => { delete guardado[k]; } };
  let hora = 1000;
  const agendaFila = [];
  const agendar = (fn, ms) => agendaFila.push({ at: hora + ms, fn });
  const roda = async () => { for (let i = 0; i < 50; i++) { await new Promise(r => setImmediate(r)); agendaFila.sort((a, b) => a.at - b.at); while (agendaFila.length && agendaFila[0].at <= hora) agendaFila.shift().fn(); } };
  const rede = R.memoria("TREINO1", { relogio: () => hora, agendar, armazem });
  const vistos = [];
  const para = rede.ouvir("vivo", v => vistos.push(v));
  await roda();
  ok(vistos.length === 1 && vistos[0] === null, "ouvir entrega o valor de agora (null)");
  // a transação com o carimbo da hora e sem campos vazios
  let r = await rede.transacao("vivo", cur => cur === null ? { seq: 1, t: R.TS, h: [], p: "00", sem: [], lider: -1 } : undefined);
  await roda();
  ok(r.feito && r.valor.t === 1000 && !("h" in r.valor) && !("sem" in r.valor) && r.valor.lider === -1, "transação: carimbo resolvido e vazios fora: " + JSON.stringify(r.valor));
  ok(vistos.length === 2 && vistos[1].seq === 1, "o ouvinte viu a transação");
  r = await rede.transacao("vivo", cur => cur === null ? { seq: 9 } : undefined);
  ok(!r.feito && r.valor.seq === 1, "transação abortada devolve o atual");
  // atualizar em vários caminhos e gravar null apaga
  await rede.atualizar("", { "escal/0": { formacao: "4-4-2" }, "escal/1": { formacao: "4-3-3", pronto: true } });
  ok((await rede.ler("escal/1/formacao")) === "4-3-3", "atualizar com caminhos");
  await rede.gravar("escal/0", null);
  ok((await rede.ler("escal/0")) === null && (await rede.ler("escal/1")) !== null, "gravar null apaga");
  await rede.gravar("escal/1", null);
  ok(!("escal" in rede._arvore()), "o pai vazio some");
  // a gravação no aparelho: outra rede com o mesmo código volta ao mesmo ponto
  hora += 500; await roda();
  ok(guardado["leilao:sala:TREINO1"] && JSON.parse(guardado["leilao:salas"]).includes("TREINO1"), "gravou a sala e o índice");
  const volta = R.memoria("TREINO1", { relogio: () => hora, agendar, armazem });
  ok((await volta.ler("vivo")).seq === 1, "o treino volta depois de recarregar");
  ok(jsonIgual(R.salasGuardadas(armazem), ["TREINO1"]), "salasGuardadas");
  // dois aparelhos no mesmo banco, com latência e transações concorrentes
  const b = rede.outroCliente({ latencia: 30 });
  const p1 = b.transacao("cont", c => (c || 0) + 1), p2 = rede.transacao("cont", c => (c || 0) + 1), p3 = b.transacao("cont", c => (c || 0) + 1);
  hora += 100; await roda();
  await Promise.all([p1, p2, p3]);
  ok((await rede.ler("cont")) === 3, "três transações concorrentes somam 3");
  // a queda: a operação espera a volta; aoCair avisa
  let caiu = 0; b.aoCair(() => caiu++);
  b._cair();
  ok(!b.conectado() && caiu === 1, "aoCair e conectado");
  let feito = false; const p4 = b.gravar("x", 1).then(() => { feito = true; });
  hora += 100; await roda();
  ok(!feito && (await rede.ler("x")) === null, "sem conexão a gravação espera");
  b._voltar(); await p4; hora += 10; await roda();
  ok(feito && (await rede.ler("x")) === 1, "na volta a gravação vai");
  para();
  rede.apagar();
  ok(!guardado["leilao:sala:TREINO1"] && !guardado["leilao:salas"], "apagar some com a gravação");
  const ms = performance.now() - t0;
  console.log(`${erros.length ? "REPROVOU" : "ok      "} R    rede em memória: ouvir, transação, carimbo, vazios, gravação, concorrência, queda (${(ms / 1000).toFixed(1)} s)`);
  if (erros.length) { falhas++; erros.forEach(e => console.log("         · " + e)); }
}

await testeProtocolo();
await testeSessao();
await testeRede();
console.log(`${falhas ? "REPROVOU" : "PASSOU"}: ${resultados.length + (SO && !SO.includes("R") ? 0 : 1) - falhas} de ${resultados.length + (SO && !SO.includes("R") ? 0 : 1)} blocos em ${((performance.now() - t00) / 1000).toFixed(1)} s`);
process.exit(falhas ? 1 : 0);
