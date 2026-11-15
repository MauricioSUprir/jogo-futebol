#!/usr/bin/env node
/* Testes do Modo Leilão (PLANO-LEILAO.md §4.1), em Node, sem navegador e sem rede.
   Carrega num `vm` o rng.js, o data.js (com um TM.storage falso), o viverde.js, o competitions.js, o ultimate.js (as
   listas do escudo desenhado; o TM.ui de mentira) e os arquivos do leilão, nas duas edições (pública e pro), e roda:
     L1 lotes · L2 ordem · L3 lance · L4 relógio · L5 fechar · L6 fim · L7 robôs · L8 protocolo (o leilão inteiro
     pela sessão e pela rede em memória = a máquina pura) · L9 formações e escalação · L10 conferência ·
     R a rede em memória · S a sessão (botões, motivos, formação, escalação, recarregar, sair, Minhas salas)
   Uma linha por bloco; o código de saída é 1 se algum reprovar.
   Uso: node ferramentas/testar-leilao.mjs [--so L1,L7] [--leiloes 1000] [-v]
   --tela: o navegador num aparelho (§4.2; o Chromium do Playwright, o TM servido daqui, o relógio do treino acelerado pelo
   gancho da sessão): "Mais modos" com 13 atalhos, o treino inteiro com 3 bots (os botões, os apagados com o motivo, o Tudo
   de dois toques, passar, outro valor), recarregar no meio, a escalação, nada sobre nada nos 8 tamanhos, a barra de lance à
   vista com o relógio rodando, o tema claro e nenhum erro no console. Uso: node ferramentas/testar-leilao.mjs --tela
   [--prints <pasta>] (o campeonato entra no PR 3). Nenhum teste usa o Firebase: o SDK do gstatic é trocado por um vazio. */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n, p) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : p; };
const SO = opt("--so", null) ? opt("--so").split(",").map(s => s.trim().toUpperCase()) : null;
const N_LEILOES = +opt("--leiloes", 1000);
const VERBOSO = args.includes("-v");
if (args.includes("--tela")) process.exit(await testeTela());
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
  // o exemplo do plano: 4 técnicos = 6 GK, 18 DF, 18 MF e 10 FW
  ok(jsonIgual(LE.cotas(4), { GK: 6, DF: 18, MF: 18, FW: 10 }), "cotas de 4 técnicos: " + JSON.stringify(LE.cotas(4)));
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
        // a fórmula do plano (§1.2), feita aqui sem o leilao.js: GK ⌈1,5T⌉, FW ⌈2,5T⌉, DF e MF dividem o resto (a sobra
        // ímpar no DF)
        const qGK = Math.ceil(1.5 * T), qFW = Math.ceil(2.5 * T), qDF = Math.ceil((13 * T - qGK - qFW) / 2);
        const qEsp = { GK: qGK, DF: qDF, MF: 13 * T - qGK - qFW - qDF, FW: qFW };
        ok(jsonIgual(q, qEsp), `${id}: cotas ${JSON.stringify(q)} (esperado ${JSON.stringify(qEsp)})`);
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
  // o "cabe" é em QUALQUER uma das 6 formações (§1.3): para cada uma, o time com as vagas dela menos uma aceita o lote que
  // só fecha nela; os parciais do plano (o 3º atacante, o 4º, o 5º zagueiro, o 5º meia) também; com nenhuma, 'posicao'
  {
    const ctxF = ctxDe("public", "br", 8, "maquina");
    const puros = g => ctxF.lotes.map((l, i) => l.grupos.length === 1 && l.pos === g ? i : -1).filter(i => i >= 0);
    const P = { GK: puros("GK"), DF: puros("DF"), MF: puros("MF"), FW: puros("FW") };
    const monta = (cont, g) => {
      const usados = { GK: 0, DF: 0, MF: 0, FW: 0 }, idx = [];
      for (const gr of GR) for (let n = 0; n < (cont[gr] || 0); n++) idx.push(P[gr][usados[gr]++]);
      const lote = P[g][usados[g]];
      if (idx.some(i => i == null) || lote == null) return null;
      let v = JSON.parse(JSON.stringify(LE.inicial(ctxF, 0)));
      v.i = lote; v.k = ctxF.fila.indexOf(lote); v = comCompras(ctxF, v, 1, idx, 1);
      return { v, idx, lote, ag: abertoEm(v, ctxF) + 10 };
    };
    const caso = (cont, g, nome, soNela) => {
      const m = monta(cont, g);
      if (!m) { ok(false, `${nome}: sem jogadores de um grupo só para montar`); return; }
      const pd = LE.pode(m.v, ctxF, 1, m.ag), r = LE.lance(m.v, ctxF, 1, 1, m.v.seq, m.ag);
      const depois = LE.formacoesQueCabem(LE.contaMascaras(m.idx.concat([m.lote]).map(i => ctxF.lotes[i])));
      if (soNela) {
        ok(jsonIgual(depois, soNela), `${nome}: com ele o time cabe em ${depois} (esperado ${soNela})`);
        ok(pd.pode && r.ok, `${nome}: pode ${pd.pode} (${pd.motivo}), lance ${r.ok ? "aceito" : r.motivo}`);
      } else ok(!depois.length && !pd.pode && pd.motivo === "posicao" && !r.ok && r.motivo === "posicao", `${nome}: cabe em ${depois}, pode ${pd.motivo}, lance ${r.motivo}`);
    };
    const UM = { "4-4-2": "MF", "4-3-3": "FW", "3-5-2": "MF", "3-4-3": "FW", "5-4-1": "DF", "4-2-4": "FW" };
    for (const f of LE.FORMACOES) {
      const vg = LE.VAGAS_FORM[f], cont = { GK: vg[0], DF: vg[1], MF: vg[2], FW: vg[3] };
      cont[UM[f]]--;
      caso(cont, UM[f], `o 11º que só fecha a ${f}`, [f]);
    }
    caso({ GK: 1, FW: 2 }, "FW", "o 3º atacante", ["4-3-3", "3-4-3", "4-2-4"]);
    caso({ GK: 1, FW: 3 }, "FW", "o 4º atacante", ["4-2-4"]);
    caso({ GK: 1, DF: 4 }, "DF", "o 5º zagueiro", ["5-4-1"]);
    caso({ GK: 1, MF: 4 }, "MF", "o 5º meia", ["3-5-2"]);
    caso({ GK: 1, FW: 4 }, "FW", "o 5º atacante", null);
    caso({ GK: 1, DF: 5 }, "DF", "o 6º zagueiro", null);
  }
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
    // o completar refeito aqui, sem o do leilao.js (§1.3): um por vez para quem tem menos jogadores (empate: o técnico de
    // menor índice), o MELHOR de fora ainda livre que cabe (pela nota; desempate pelo id)
    {
      const foraOrd = ctx.fora.map((_, j) => j).sort((x, y) => cmpNota(ctx.fora[x], ctx.fora[y]));
      const tms = [], trav = [], fEsp = ctx.fora.map(() => "-");
      for (let t = 0; t < ctx.T; t++) { tms.push([]); trav.push(false); }
      for (let i = 0; i < d.length; i++) if (d[i] !== "-") tms[L.LETRAS.indexOf(d[i])].push(ctx.lotes[i]);
      for (;;) {
        let alvo = -1;
        for (let t = 0; t < ctx.T; t++) if (tms[t].length < 11 && !trav[t] && (alvo < 0 || tms[t].length < tms[alvo].length)) alvo = t;
        if (alvo < 0) break;
        const j = foraOrd.find(j => fEsp[j] === "-" && L.formacoesQueCabem(L.contaMascaras(tms[alvo].concat([ctx.fora[j]]))).length > 0);
        if (j == null) { trav[alvo] = true; continue; }
        fEsp[j] = L.letra(alvo); tms[alvo].push(ctx.fora[j]);
      }
      ok(fEsp.join("") === (f || fEsp.map(() => "-").join("")), `${id}: o completar não deu os melhores de fora na ordem (${f} × esperado ${fEsp.join("")})`);
    }
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
  // estados pulados de qualquer tamanho (o ouvinte do Firebase pode perder vários lotes): pares (j, k) sorteados de leilões
  // honestos com repescagem, lotes pulados e completar de graça — e o fim, que nada muda depois
  const rp = rngT("L10-pulos");
  const leiloesP = [
    ["en", 6, "conferencia", null],
    ["br", 4, "pulos-passa", { humanos: [0], politica: (v, c, t) => (v.lider ?? -1) !== t && LE.pode(v, c, t).pode ? { acao: "passar", quando: v.abre + c.espera + 200 } : null }],
    ["jp", 3, "pulos-todos", { humanos: [0, 1, 2], politica: (v, c, t) => LE.pode(v, c, t).pode ? (v.k % 3 === t ? { acao: "lance", alvo: (v.valor || 0) + 1, quando: v.abre + c.espera + 100 + t } : { acao: "passar", quando: v.abre + c.espera + 300 + t }) : null }],
    ["it", 8, "pulos-guloso", { humanos: [1], politica: (v, c, t) => LE.pode(v, c, t).pode ? { acao: "lance", alvo: (v.valor || 0) + 1, quando: Math.max(v.abre + c.espera, v.t || 0) + 300 } : null }]
  ].map(([liga, T, sem, o]) => { const c = ctxDe("public", liga, T, sem); const rr = leilaoRobos(c, o || undefined); rr.erros.forEach(e => ok(false, `${liga}/T${T}: ${e}`)); return { ctx: c, E: rr.estados }; });
  let paresHonestos = 0, paresAcusados = 0, comRep = 0, comFim = 0;
  for (const { ctx: c, E: EE } of leiloesP) {
    for (let n = 0; n < 1500; n++) {
      const j = Math.floor(rp() * EE.length), k = j + Math.floor(rp() * (EE.length - j));
      if (k === j && n % 2) continue;
      paresHonestos++;
      if (EE[k].fase === "rep") comRep++;
      if (EE[k].fase === "fim") comFim++;
      const cc = LE.conferir(EE[j], EE[k], c);
      if (!cc.ok) { paresAcusados++; if (paresAcusados <= 3) ok(false, `honesto acusado: ${cc.motivo} de ${j} (seq ${EE[j].seq}, ${EE[j].fase}) a ${k} (seq ${EE[k].seq}, ${EE[k].fase}) em ${c.semente}`); }
    }
  }
  ok(paresAcusados === 0, `${paresAcusados} de ${paresHonestos} pares honestos com estados pulados acusados`);
  ok(comRep > 50 && comFim > 50, `pares com a repescagem (${comRep}) e com o fim (${comFim})`);
  // adulterações com o seq pulando 2 ou mais (nos 4 leilões: com repescagem e lotes pulados)
  const motivosPulo = [], feitos = new Set();
  for (const { ctx: c, E: EE } of leiloesP) {
    const NV = v => LE.norm(v, c);
    const novosDe = (a, b) => { const out = []; for (let i = 0; i < c.L; i++) if (a.d[i] === "-" && b.d[i] !== "-") out.push(i); return out; };
    const pares = [];
    for (let j = 1; j < EE.length; j++) for (let k = j + 1; k < EE.length && EE[k].seq <= EE[j].seq + 4; k++) if (EE[k].seq >= EE[j].seq + 2) pares.push([NV(EE[j]), NV(EE[k])]);
    ok(pares.length > 50, `${c.semente}: pares com o seq pulando 2 a 4: ${pares.length}`);
    const acusaPulo = (a, b, nome) => { const r = LE.conferir(a, b, c); ok(!r.ok, `${c.semente}: ${nome}: não acusou`); motivosPulo.push(r.motivo); if (VERBOSO) console.log("         " + c.semente + ": " + nome + " → " + r.motivo); return r.motivo; };
    const darLote = (b, t, i, preco) => { b.d = b.d.slice(0, i) + LE.letra(t) + b.d.slice(i + 1); b.cx[t][0] -= preco; b.cx[t][1] -= 1; b.cx[t][2 + GR.indexOf(c.lotes[i].pos)]++; };
    const tirarLote = (b, t, i, preco) => { b.d = b.d.slice(0, i) + "-" + b.d.slice(i + 1); b.cx[t][0] += preco; b.cx[t][1] += 1; b.cx[t][2 + GR.indexOf(c.lotes[i].pos)]--; };
    const semCompra = (a, b) => { const nv = novosDe(a, b), q = []; for (let t = 0; t < c.T; t++) if (!nv.some(i => b.d[i] === LE.letra(t))) q.push(t); return q; };
    const pagou = (a, b, t) => a.cx[t][0] - b.cx[t][0];
    const feitosAqui = new Set();
    const vez = nome => !feitosAqui.has(nome) && (feitosAqui.add(nome), feitos.add(nome), true);
    for (const [a, b] of pares) {
      const livres = semCompra(a, b), nv = novosDe(a, b);
      // um lote da janela (comprado por u, que só comprou ele) passa de graça para quem não comprou nada
      if (!feitosAqui.has("janela") && livres.length) {
        // (t com folga no caixa: sozinho, o vivo continua de pé — só a conta do salto acusa)
        const folga = t => b.cx[t][0] <= LE.SALDO - (LE.VAGAS - b.cx[t][1]) - 1;
        const i = nv.find(i => i !== a.i && nv.filter(x => b.d[x] === b.d[i]).length === 1), t = i == null ? null : livres.find(t => LE.cabeLote(b, c, t, i) && b.cx[t][1] > 1 && folga(t));
        if (t != null) {
          const u = LE.LETRAS.indexOf(b.d[i]), b1 = cl(b); tirarLote(b1, u, i, pagou(a, b, u)); darLote(b1, t, i, 0); vez("janela");
          const m = acusaPulo(a, b1, "seq+2: lote da janela de graça"); ok(m === "fechamento", `${c.semente}: o lote da janela de graça acusado como ${m}`);
        }
      }
      // o melhor lote ainda por vir (depois do de b), com R$ 1 descontado
      if (!feitosAqui.has("futuro") && livres.length && b.fase === "lotes") {
        const t = livres[0], fut = c.fila.slice(b.k + 1).filter(i => b.d[i] === "-" && !(b.sem || []).includes(i) && LE.cabeLote(b, c, t, i));
        const i = fut.sort((x, y) => c.lotes[y].overall - c.lotes[x].overall)[0];
        if (i != null && b.cx[t][0] > b.cx[t][1]) { const b2 = cl(b); darLote(b2, t, i, 1); vez("futuro"); acusaPulo(a, b2, "seq+2: lote ainda por vir"); }
      }
      // quem não comprou pagou
      if (!feitosAqui.has("pagou") && livres.some(t => b.cx[t][0] >= 2 + b.cx[t][1])) { const t = livres.find(t => b.cx[t][0] >= 2 + b.cx[t][1]), b3 = cl(b); b3.cx[t][0] -= 2; vez("pagou"); acusaPulo(a, b3, "seq+2: saldo que cai sem compra"); }
      // o seq que pula mais do que a janela
      if (vez("seq")) { const b4 = cl(b); b4.seq += 60; acusaPulo(a, b4, "seq+60 sem lotes para tanto"); }
      // a posição que volta (o lote de b é o de uma posição antes da de a, ainda sem dono)
      if (!feitosAqui.has("volta") && a.fase === b.fase && a.k > 0) {
        const lista = a.fase === "lotes" ? c.fila : (b.sem || []), k = [...Array(a.k).keys()].reverse().find(k => b.d[lista[k]] === "-");
        if (k != null) { const b5 = cl(b); b5.k = k; b5.i = lista[k]; vez("volta"); acusaPulo(a, b5, "seq+2 com a posição de volta"); }
      }
      // o lote de a com líder sem dono em b (a compra desfeita)
      if (!feitosAqui.has("lider") && a.lider >= 0 && b.d[a.i] !== "-" && nv.filter(i => b.d[i] === b.d[a.i]).length === 1) {
        const dono = LE.LETRAS.indexOf(b.d[a.i]), b6 = cl(b); tirarLote(b6, dono, a.i, pagou(a, b, dono)); vez("lider"); acusaPulo(a, b6, "seq+2: o lote com líder sem dono");
      }
      // o lote de a vendido por menos que o lance (o líder sem outra compra)
      if (!feitosAqui.has("barato") && a.lider >= 0 && a.valor >= 3 && b.d[a.i] === LE.letra(a.lider) && nv.filter(i => b.d[i] === b.d[a.i]).length === 1) {
        const b7 = cl(b); b7.cx[a.lider][0] = a.cx[a.lider][0] - 1; vez("barato"); acusaPulo(a, b7, "seq+2: o lote de a por R$ 1 (lance de R$ " + a.valor + ")");
      }
      // um lote sem lance tirado da repescagem: parece pulado, mas alguém podia comprar
      if (!feitosAqui.has("pulado") && a.fase === "lotes" && b.fase === "lotes") {
        const novosSem = (b.sem || []).slice((a.sem || []).length).filter(i => i !== a.i);
        if (novosSem.length) {
          const b8 = cl(b); b8.sem = b8.sem.filter(i => i !== novosSem[0]); vez("pulado");
          const m = acusaPulo(a, b8, "seq+2: lote sem lance tirado da repescagem"); ok(m === "pulado", `${c.semente}: o lote tirado da repescagem acusado como ${m}`);
        }
      }
      // a repescagem perde um lote antigo
      if (!feitosAqui.has("sem") && (a.sem || []).length) { const b9 = cl(b); b9.sem = b9.sem.slice(1); vez("sem"); acusaPulo(a, b9, "seq+2: a `sem` perde um lote"); }
    }
  }
  for (const caso of ["janela", "futuro", "pagou", "seq", "volta", "lider", "barato", "pulado", "sem"]) ok(feitos.has(caso), `adulteração com o seq pulando não montada: ${caso}`);
  // depois do fim: nada muda (nem o seq, nem os de graça); o `f` do fim = o completar das compras (também visto de longe)
  {
    let fimC = null;
    for (const { ctx: c, E: EE } of leiloesP) { const ult = LE.norm(EE[EE.length - 1], c); if ((ult.f || "").replace(/-/g, "").length >= 2) { fimC = { c, EE, ult }; break; } }
    ok(!!fimC, "nenhum fim com completados de graça");
    if (fimC) {
      const { c, EE, ult } = fimC, f = ult.f.split("");
      const acusaFim = (a, b, nome) => { const r = LE.conferir(a, b, c); ok(!r.ok, `${nome}: não acusou`); motivosPulo.push(r.motivo); return r.motivo; };
      const b1 = cl(ult); b1.seq++; acusaFim(ult, b1, "depois do fim, seq+1 sem mudar nada");
      // dois de graça do mesmo grupo trocados entre técnicos (ou um de graça trocado pelo melhor de fora livre)
      let troca = null;
      for (let j = 0; j < f.length && !troca; j++) for (let k = 0; k < f.length && !troca; k++) if (f[j] !== "-" && f[k] !== "-" && f[j] !== f[k] && c.fora[j].pos === c.fora[k].pos) troca = [j, k];
      if (!troca) for (let j = 0; j < f.length && !troca; j++) for (let k = 0; k < f.length && !troca; k++) if (f[j] !== "-" && f[k] === "-" && c.fora[j].pos === c.fora[k].pos) troca = [j, k];
      ok(!!troca, "nenhuma troca possível no completar");
      if (troca) {
        const f2 = f.slice(); [f2[troca[0]], f2[troca[1]]] = [f2[troca[1]], f2[troca[0]]];
        const b2 = cl(ult); b2.f = f2.join("");
        const b3 = cl(b2); b3.seq++;
        acusaFim(ult, b2, "depois do fim, o completar trocado (mesmo seq)");
        acusaFim(ult, b3, "depois do fim, o completar trocado (seq+1)");
        const m4 = acusaFim(EE[Math.floor(EE.length / 2)], b2, "o fim visto de longe com o completar trocado");
        ok(m4 === "completar", "o completar trocado acusado como " + m4);
        ok(!LE.conferir(null, b2, c).ok, "o completar trocado sem o vivo anterior: não acusou");
      }
    }
  }
  ok(acusadas === 0, `${acusadas} de ${honestas} transições honestas acusadas`);
  nota(`${honestas} transições honestas (também com estados pulados), ${motivos.length} adulterações acusadas (${[...new Set(motivos)].join(", ")}); ${paresHonestos} pares honestos com saltos de qualquer tamanho (${comRep} na repescagem, ${comFim} no fim), ${motivosPulo.length} adulterações com o seq pulando ou depois do fim (${[...new Set(motivosPulo)].join(", ")})`);
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

/* ================= --tela: o navegador num aparelho (PLANO-LEILAO.md §4.2) =================
   O TM servido desta pasta (o servidor e o Playwright do golaco/tools/lib/navegador.mjs), o SDK do Firebase trocado por um
   vazio (o treino não usa a rede), o relógio do treino acelerado por TM.leilaoSessao.acelerar. Uma linha por item. */
async function testeTela() {
  const t0 = performance.now();
  const WT = path.resolve(RAIZ, "..");
  const { servidor, playwright } = await import(pathToFileURL(path.join(WT, "golaco/tools/lib/navegador.mjs")).href);
  const PASTA = opt("--prints", "/tmp/testar-leilao-tela");
  fs.mkdirSync(PASTA, { recursive: true });
  const srv = await servidor(0, RAIZ);
  const { chromium } = playwright();
  // com a barra de rolagem do PC (o headless esconde por padrão): a grade de 7 + 6 é medida com ela
  const nav = await chromium.launch({ headless: true, ignoreDefaultArgs: ["--hide-scrollbars"] });
  const TAMANHOS = [[360, 740], [390, 844], [430, 932], [844, 390], [820, 1180], [1280, 800], [1440, 900], [1920, 1080]];
  const errosPagina = [], oks = [], falhasT = [];
  const espera = ms => new Promise(r => setTimeout(r, ms));
  function confere(nome, cond, info) {
    (cond ? oks : falhasT).push(nome + (!cond && info != null ? " — " + JSON.stringify(info).slice(0, 1200) : ""));
    console.log((cond ? "ok       " : "REPROVOU ") + nome + (cond && VERBOSO && info != null ? " — " + JSON.stringify(info).slice(0, 400) : ""));
    if (!cond && info != null) console.log("         · " + JSON.stringify(info).slice(0, 1200));
  }
  async function aparelho(w, h, mob) {
    const cx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: !!mob, hasTouch: !!mob, serviceWorkers: "block" });
    await cx.route(/^https:\/\/www\.gstatic\.com\//, r => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    await cx.addInitScript(() => { try { localStorage.setItem("totalmatch:__edition", "public"); } catch (e) {} });
    const p = await cx.newPage();
    p.on("pageerror", e => errosPagina.push(String(e).slice(0, 300)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errosPagina.push("console: " + m.text().slice(0, 300)); });
    await p.goto(srv.url + "index.html", { waitUntil: "load" });
    await p.waitForFunction(() => window.TM && TM.ui && TM.leilaoSessao && TM.leilaoTela, null, { timeout: 60000 });
    await p.evaluate(() => TM.ui.go("modes"));
    await espera(300);
    return { cx, p };
  }
  async function ate(p, fn, arg, ms = 20000) { try { await p.waitForFunction(fn, arg, { timeout: ms, polling: 40 }); return true; } catch (e) { return false; } }
  const ver = p => p.evaluate(() => { const S = TM.leilaoSessao.atual(); return S ? S.ver() : null; });
  const print = (p, nome) => p.screenshot({ path: path.join(PASTA, nome + ".png") }).catch(() => {});
  const clica = (p, rx, sel = "button") => p.evaluate(([rx, sel]) => {
    const x = [...document.querySelectorAll(sel)].find(e => new RegExp(rx).test(e.textContent.trim()) && e.offsetParent !== null);
    if (x) x.click(); return !!x;
  }, [rx, sel]);
  // nada sobre nada: o critério do testar-online3d.mjs (sobreposicao), com a barra de lance (fixa) numa camada própria — o
  // que rola por baixo dela não "encosta" nela; no fim da rolagem, nada fica atrás dela (o espaço do fim da página)
  const sobreposicao = p => p.evaluate(() => {
    const sel = "button, a[href], [role=button], input, select, .ut-card, .lei-placar, .lei-meu, .lei-bloco, .next-match, .lei-sala, .lei-caixa";
    const visivel = e => {
      const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.05 || cs.pointerEvents === "none") return false;
      const rc = e.getBoundingClientRect(); if (rc.width < 4 || rc.height < 4) return false;
      let a = e.parentElement; while (a) { const c2 = getComputedStyle(a); if (c2.display === "none" || c2.visibility === "hidden" || +c2.opacity < 0.05) return false; a = a.parentElement; }
      return true;
    };
    const camada = e => { let a = e; while (a && a !== document.body) { if (getComputedStyle(a).position === "fixed") return a; a = a.parentElement; } return null; };
    const els = [...document.querySelectorAll(sel)].filter(visivel);
    const nome = e => (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : e.tagName) + (e.textContent ? ' "' + e.textContent.trim().slice(0, 18) + '"' : "");
    const pares = [], encostam = [];
    // clicáveis vizinhos: nem por cima (> 1 px) nem encostados (menos de 2 px entre as bordas)
    const clicavel = e => e.matches("button, a[href], [role=button], input, select");
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const X = els[i], Y = els[j];
      if (X.contains(Y) || Y.contains(X) || camada(X) !== camada(Y)) continue;
      const a = X.getBoundingClientRect(), bb = Y.getBoundingClientRect();
      const ix = Math.min(a.right, bb.right) - Math.max(a.left, bb.left), iy = Math.min(a.bottom, bb.bottom) - Math.max(a.top, bb.top);
      if (ix > 1 && iy > 1) pares.push(nome(X) + " X " + nome(Y));
      else if (ix > -2 && iy > -2 && clicavel(X) && clicavel(Y)) encostam.push(nome(X) + " | " + nome(Y) + " (" + Math.round(Math.max(-ix, -iy) * 10) / 10 + " px)");
    }
    // o texto de dentro de um botão não sai dele (o rótulo "Tudo ou nada" passava do botão 4-2-4)
    const saem = [];
    els.filter(e => e.matches("button")).forEach(b => {
      const rb = b.getBoundingClientRect();
      b.querySelectorAll("span, div, small, strong, b").forEach(x => {
        if (!x.childNodes.length || ![...x.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
        const cs = getComputedStyle(x); if (cs.display === "none" || cs.visibility === "hidden") return;
        const r = x.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
        if (r.left < rb.left - 1 || r.right > rb.right + 1 || r.top < rb.top - 1 || r.bottom > rb.bottom + 1) saem.push(nome(x) + " em " + nome(b) + " (" + Math.round(r.left) + "–" + Math.round(r.right) + " no " + Math.round(rb.left) + "–" + Math.round(rb.right) + ")");
      });
    });
    const larg = document.documentElement.clientWidth;
    const fora = els.filter(e => { const rc = e.getBoundingClientRect(); return rc.right > larg + 1 || rc.left < -1; }).map(nome);
    // no fim da rolagem, o último da página termina acima da barra fixa
    let atras = null;
    const barra = document.querySelector(".lei-lance:not([hidden])");
    if (barra) {
      const y0 = scrollY; scrollTo(0, document.documentElement.scrollHeight);
      const topo = barra.getBoundingClientRect().top;
      const baixo = els.filter(e => !camada(e)).map(e => e.getBoundingClientRect().bottom);
      const fundo = Math.max(...baixo);
      if (fundo > topo + 1) atras = Math.round(fundo - topo);
      scrollTo(0, y0);
    }
    return { n: els.length, sobre: pares, encostam, saem, fora, rolaLado: document.documentElement.scrollWidth > larg + 1, atras };
  });
  const nadaSobre = [];
  async function nadaSobreNada(p, rotulo, extra) {
    for (const [w, h] of TAMANHOS) {
      await p.setViewportSize({ width: w, height: h });
      await espera(320);
      await p.evaluate(() => { document.querySelectorAll(".toast").forEach(t => t.remove()); scrollTo(0, 0); });
      const s = await sobreposicao(p);
      const r = { tela: rotulo + " " + w + "x" + h, n: s.n, sobre: s.sobre.slice(0, 4), encostam: s.encostam.slice(0, 4), saem: s.saem.slice(0, 4), fora: s.fora.slice(0, 4), rolaLado: s.rolaLado, atras: s.atras };
      if (extra) Object.assign(r, await extra(p, w, h));
      nadaSobre.push(r);
      await print(p, `nada-${rotulo}-${w}x${h}`);
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await espera(250);
  }
  const textoMotivos = await (async () => { const { p } = await aparelho(390, 844, true); const m = await p.evaluate(() => ["max", "goleiro", "posicao", "completo", "lider", "passou", "pausa", "tarde", "fim"].map(k => [k, TM.leilaoSessao.textoMotivo(k, { max: 0 })])); await p.context().close(); return m; })();

  try {
    /* T1 "Mais modos": 13 atalhos, 7 + 6 no PC (com a barra de rolagem) e no tablet, 3·4 + 1 no celular */
    const pc = await aparelho(1280, 800, false);
    const grade = [];
    for (const [w, h] of [[1280, 800], [1440, 900], [1920, 1080], [820, 1180], [790, 800]]) {
      await pc.p.setViewportSize({ width: w, height: h });
      await pc.p.evaluate(() => TM.ui.go("modes"));
      await espera(300);
      grade.push(await pc.p.evaluate(w => {
        const bs = [...document.querySelectorAll(".vit-mais-b")].filter(b => b.offsetParent !== null);
        const tops = [...new Set(bs.map(b => Math.round(b.getBoundingClientRect().top)))].sort((a, b) => a - b);
        const quebra = bs.filter(b => b.lastElementChild && b.lastElementChild.getBoundingClientRect().height > 22).map(b => b.textContent.trim());
        return { tela: w, barra: innerWidth - document.documentElement.clientWidth, n: bs.length, linhas: tops.map(t => bs.filter(b => Math.round(b.getBoundingClientRect().top) === t).length).join("+"), quebra,
          emoji: bs.some(b => /\p{Extended_Pictographic}/u.test(b.textContent)) };
      }, w));
    }
    await pc.cx.close();
    const cel = await aparelho(360, 740, true);
    const gCel = await cel.p.evaluate(() => {
      const bs = [...document.querySelectorAll(".vit-mais-b")].filter(b => b.offsetParent !== null), rs = bs.map(b => b.getBoundingClientRect());
      const tops = [...new Set(rs.map(r => Math.round(r.top)))].sort((a, b) => a - b), ult = rs.filter(r => Math.round(r.top) === tops[tops.length - 1]);
      const larg = Math.max(...rs.map(r => r.right)) - Math.min(...rs.map(r => r.left));
      const lei = bs.find(b => b.textContent.trim() === "Leilão");
      return { n: bs.length, linhas: tops.map(t => rs.filter(r => Math.round(r.top) === t).length).join("+"), ultima: ult.length === 1 ? Math.round(ult[0].width / larg * 100) : null,
        quebra: bs.filter(b => b.lastElementChild && b.lastElementChild.getBoundingClientRect().height > 22).map(b => b.textContent.trim()),
        leilao: lei ? { icone: !!lei.querySelector("svg.tm-ic"), emoji: /\p{Extended_Pictographic}/u.test(lei.textContent) } : null };
    });
    confere("T1 'Mais modos' com 13 atalhos: 7 + 6 no PC com a barra de rolagem (1280, 1440, 1920, 790) e no tablet (820), sem nome quebrado nem emoji",
      grade.every(g => g.n === 13 && g.linhas === "7+6" && !g.quebra.length && !g.emoji) && grade.some(g => g.barra >= 12), grade);
    confere("T1 no celular 3 + 3 + 3 + 3 + 1 (o 13º na linha inteira); 'Leilão' com o ícone (gavel) e sem emoji",
      gCel.n === 13 && gCel.linhas === "3+3+3+3+1" && gCel.ultima >= 95 && !gCel.quebra.length && gCel.leilao && gCel.leilao.icone && !gCel.leilao.emoji, gCel);
    await cel.cx.close();

    /* T2 a Entrada e o Criar (o treino) */
    const { p } = await aparelho(390, 844, true);
    // o que fica escrito na região ao vivo (#lei-vivo) e por quanto tempo: o que o leitor de tela ouve (também depois de recarregar)
    const vigiaVivo = () => { window.__vivo = []; const ir = () => { const r = document.getElementById("lei-vivo"); if (r) new MutationObserver(() => window.__vivo.push([performance.now(), r.textContent])).observe(r, { childList: true, characterData: true, subtree: true }); };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ir); else ir(); };
    await p.context().addInitScript(vigiaVivo);
    await p.evaluate(vigiaVivo);
    const html = await (await fetch(srv.url + "index.html")).text();
    confere("T2 a região ao vivo no HTML inicial (#lei-vivo, role=status, aria-live=polite) e os 4 arquivos do leilão no index.html",
      /<div id="lei-vivo"[^>]*role="status"[^>]*aria-live="polite"/.test(html) && ["leilao.js", "leilao-rede.js", "leilao-sessao.js", "leilao-tela.js"].every(f => html.includes("js/" + f + "?v=")));
    await p.evaluate(() => [...document.querySelectorAll(".vit-mais-b")].find(b => b.textContent.trim() === "Leilão").click());
    await espera(400);
    const entrada = await p.evaluate(() => ({ rota: TM.ui.current(), txt: document.querySelector(".screen.is-active").innerText.replace(/\s+/g, " "),
      off: [...document.querySelectorAll(".lei-online button")].map(b => b.disabled) }));
    confere("T2 o atalho abre a Entrada: Treinar contra bots, o online 'Em breve' com os botões desligados", entrada.rota === "leilao" && /Treinar contra bots/.test(entrada.txt) && /Em breve/i.test(entrada.txt) && entrada.off.length === 2 && entrada.off.every(Boolean), entrada);
    await nadaSobreNada(p, "entrada");
    await clica(p, "^Treinar contra bots$");
    await espera(400);
    confere("T2 'Treinar contra bots' abre a Criar sala", await p.evaluate(() => TM.ui.current()) === "leilao-criar");
    await nadaSobreNada(p, "criar");
    // os técnicos 2–8 (contando os bots)
    const passo = await p.evaluate(async () => {
      const menos = document.querySelector('[aria-label="Menos um técnico"]'), mais = document.querySelector('[aria-label="Mais um técnico"]'), n = () => +document.querySelector(".lei-passo-n").textContent;
      for (let i = 0; i < 10; i++) menos.click();
      const min = n(), menosOff = menos.disabled;
      for (let i = 0; i < 10; i++) mais.click();
      const max = n(), maisOff = mais.disabled, hint = document.querySelector(".lei-criar-lt .setting-hint").textContent;
      for (let i = 0; i < 4; i++) menos.click();
      return { min, menosOff, max, maisOff, hint, agora: n(), resumo: document.querySelector(".lei-criar-resumo").textContent };
    });
    confere("T2 técnicos de 2 a 8 (os botões param nas pontas), 'Você e 7 bots', a duração estimada; volta a 4 (3 bots)",
      passo.min === 2 && passo.menosOff && passo.max === 8 && passo.maisOff && /Você e 7 bots/.test(passo.hint) && passo.agora === 4 && /cerca de \d+ a \d+ min/.test(passo.resumo), passo);
    // a liga pela folha; a formação 4-3-3; o clube
    await p.click(".lei-liga-bt");
    await espera(300);
    const ligaEscolhida = await p.evaluate(() => { const b = [...document.querySelectorAll(".lei-folha .lei-liga")][1]; const n = b.querySelector(".lei-liga-n").textContent; b.click(); return n; });
    await espera(250);
    await p.evaluate(() => [...document.querySelectorAll(".lei-criar .lei-forma-bt")].find(b => /4-3-3/.test(b.textContent)).click());
    await p.click(".lei-esc-abre");
    await espera(150);
    await p.fill(".lei-criar .lei-campo:not(.lei-campo-sigla)", "Clube Teste");
    const corEscolhida = await p.evaluate(() => { const c = [...document.querySelectorAll(".lei-cor")][2]; c.click(); return c.style.background; });
    await espera(150);
    const criar = await p.evaluate(() => ({ liga: document.querySelector(".lei-liga-bt .lei-liga-n").textContent, sigla: document.querySelector(".lei-campo-sigla").value,
      forma: document.querySelector(".lei-criar .lei-forma-bt.active").textContent, folhas: document.querySelectorAll(".lei-folha").length }));
    confere("T2 a liga pela folha, a formação, o nome e a sigla do clube (CT) e a cor", criar.liga === ligaEscolhida && criar.sigla === "CT" && /4-3-3/.test(criar.forma) && criar.folhas === 0 && !!corEscolhida, criar);
    await print(p, "2-criar");
    await clica(p, "Começar o treino");
    const abriu = await ate(p, () => TM.ui.current() === "leilao-lote" && !!document.querySelector(".lei-relogio"));
    let V = await ver(p);
    confere("T2 'Começar o treino' abre a aba Leilão: 4 técnicos (você + 3 bots), 52 lotes, a liga e o clube escolhidos",
      abriu && V && V.T === 4 && V.lote && V.lote.total === 52 && V.liga.nome === ligaEscolhida && V.tecnicos[V.eu].clube.nome === "Clube Teste" && V.tecnicos.filter(t => t.bot).length === 3
      && V.tecnicos.filter(t => t.bot).every(t => /^Bot /.test(t.nome)), V && { T: V.T, liga: V.liga, clube: V.tecnicos[V.eu] && V.tecnicos[V.eu].clube });
    await p.evaluate(() => TM.leilaoSessao.acelerar(0.5));

    /* T3 o leilão: os botões, os apagados com o motivo, o Tudo de dois toques, passar, outro valor */
    const pausa = await p.evaluate(() => { const V = TM.leilaoSessao.atual().ver(); return { pausa: V.lote.pausa, dis: [...document.querySelectorAll(".lei-l1 .lei-lb")].map(b => b.disabled), msg: document.querySelector(".lei-lance-msg").textContent }; });
    confere("T3 na pausa entre os lotes os botões ficam apagados com o motivo ('Aguarde o próximo jogador')", !pausa.pausa || (pausa.dis.every(Boolean) && /Aguarde/.test(pausa.msg)), pausa);
    const abertoMeu = () => ate(p, () => { const S = TM.leilaoSessao.atual(); if (!S) return false; const V = S.ver(); const b = document.querySelector('.lei-lb-passo[data-tipo="+1"]');
      return V.lote && !V.lote.pausa && !V.lote.fechando && V.lote.fim - S.hora() > 3000 && V.botoes["+1"].pode && V.lote.lider !== V.eu && b && !b.disabled; }, null, 60000);
    const proximoLote = async () => { const s = (await ver(p)).lote.seq; await ate(p, s => { const V = TM.leilaoSessao.atual().ver(); return V.lote && V.lote.seq !== s; }, s, 60000); };
    // +1
    await abertoMeu();
    let antes = await ver(p);
    await p.click('.lei-lb-passo[data-tipo="+1"]');
    await espera(250);
    let depois = await p.evaluate(() => ({ V: TM.leilaoSessao.atual().ver(), msg: document.querySelector(".lei-lance-msg").textContent, dis: document.querySelector('.lei-lb-passo[data-tipo="+1"]').disabled }));
    const lidera = depois.V.lote.seq === antes.lote.seq && depois.V.lote.lider === depois.V.eu;
    confere("T3 '+1' sobre o valor visto: 'Lance de R$ X: você lidera' (ou 'Alguém chegou antes'); liderando, o +1 apaga com 'Você lidera'",
      (lidera && depois.V.lote.valor >= antes.lote.valor + 1 && depois.msg === "Lance de R$ " + depois.V.lote.valor + ": você lidera" && depois.dis && depois.V.botoes["+1"].motivo === "lider") || (!lidera && /chegou antes|já fechou/.test(depois.msg)),
      { antes: antes.lote.valor, depois: depois.V.lote.valor, msg: depois.msg });
    await espera(2700);
    const msgLider = await p.evaluate(() => { const V = TM.leilaoSessao.atual().ver(); return { lider: V.lote && V.lote.lider === V.eu, msg: document.querySelector(".lei-lance-msg").textContent }; });
    if (msgLider.lider) confere("T3 passado o retorno, a linha de cima mostra o motivo do +1 apagado ('Você lidera')", /Você lidera/.test(msgLider.msg), msgLider);
    // Passar (num lote em que não lidero)
    await proximoLote(); await abertoMeu();
    await p.click(".lei-lb-passar");
    await espera(250);
    depois = await p.evaluate(() => { const V = TM.leilaoSessao.atual().ver(); return { passou: V.tecnicos[V.eu].passou, msg: document.querySelector(".lei-lance-msg").textContent, passarOff: document.querySelector(".lei-lb-passar").disabled, umOff: document.querySelector('.lei-lb-passo[data-tipo="+1"]').disabled, motivo: V.botoes && V.botoes["+1"].motivo, seq: V.lote && V.lote.seq }; });
    confere("T3 'Passar': 'Você passou neste jogador', e o Passar e o +1 apagam (motivo 'passou')", (depois.passou && /passou/.test(depois.msg) && depois.passarOff && depois.umOff && depois.motivo === "passou") || /já fechou/.test(depois.msg), depois);
    // outro valor: acima do máximo (recusado na tela) e um valor bom
    await proximoLote(); await abertoMeu();
    antes = await ver(p);
    await p.fill(".lei-valor", String(antes.botoes.outro.max + 5));
    await p.click(".lei-lb-dar");
    await espera(200);
    const msgMax = await p.evaluate(() => document.querySelector(".lei-lance-msg").textContent);
    const alvoOutro = Math.min(antes.botoes.outro.max, (await ver(p)).lote.valor + 3);
    await p.fill(".lei-valor", String(alvoOutro));
    await p.press(".lei-valor", "Enter");
    await espera(250);
    depois = await p.evaluate(() => ({ V: TM.leilaoSessao.atual().ver(), msg: document.querySelector(".lei-lance-msg").textContent, campo: document.querySelector(".lei-valor").value }));
    confere("T3 'Outro valor': acima do máximo fica na tela ('Acima do seu máximo R$ X'); um valor bom (Enter) vira lance e o campo esvazia",
      /Acima do seu máximo R\$ \d+/.test(msgMax) && ((depois.V.lote.lider === depois.V.eu && depois.V.lote.valor === alvoOutro && depois.campo === "") || /chegou antes|já fechou|tem de passar/.test(depois.msg)), { msgMax, alvoOutro, valor: depois.V.lote.valor, msg: depois.msg });
    // Tudo: o 1º toque vira "Confirmar R$ X" (nada sai), o 2º dá o lance do máximo
    await proximoLote(); await abertoMeu();
    antes = await ver(p);
    await p.click(".lei-lb-tudo");
    await espera(120);
    const conf = await p.evaluate(() => { const b = document.querySelector(".lei-lb-tudo"), V = TM.leilaoSessao.atual().ver(); return { txt: b.textContent, cls: b.className, lider: V.lote.lider, valor: V.lote.valor, msg: document.querySelector(".lei-lance-msg").textContent, aria: b.getAttribute("aria-label") }; });
    await p.click(".lei-lb-tudo");
    await espera(250);
    depois = await p.evaluate(() => ({ V: TM.leilaoSessao.atual().ver(), msg: document.querySelector(".lei-lance-msg").textContent }));
    confere("T3 'Tudo' de dois toques: o 1º vira 'Confirmar R$ X' por 2 s sem dar lance; o 2º dá o lance do máximo",
      /Confirmar/.test(conf.txt) && /confirma/.test(conf.cls) && conf.lider !== antes.eu && /confirmar R\$ \d+/i.test(conf.msg) && /Confirmar o lance de R\$ \d+/.test(conf.aria)
      // com o lance do máximo, ninguém cobre: o lote fecha logo (a venda para mim pelo máximo) ou ainda está aberto comigo na frente
      && ((depois.msg === "Lance de R$ " + antes.botoes.tudo.alvo + ": você lidera" && ((depois.V.lote && depois.V.lote.seq === antes.lote.seq && depois.V.lote.lider === depois.V.eu && depois.V.lote.valor === antes.botoes.tudo.alvo)
        || (depois.V.ultimo && depois.V.ultimo.tipo === "vendido" && depois.V.ultimo.t === depois.V.eu && depois.V.ultimo.preco === antes.botoes.tudo.alvo)))
        || /chegou antes|já fechou/.test(depois.msg)), { conf, ultimo: depois.V.ultimo, alvo: antes.botoes.tudo.alvo, msg: depois.msg });
    // os 2 s do Tudo passam e o botão volta
    const tudoVolta = await p.evaluate(async () => { const b = document.querySelector(".lei-lb-tudo"); b.click(); const a = /Confirmar/.test(b.textContent); await new Promise(r => setTimeout(r, 2300)); return { a, b: /Confirmar/.test(b.textContent) }; });
    confere("T3 sem o 2º toque, o 'Confirmar' volta a 'Tudo' depois de 2 s", !tudoVolta.b, tudoVolta);

    /* T4 nada sobre nada e a barra de lance à vista com o relógio rodando, nos 8 tamanhos (num lote aberto e lento) */
    await proximoLote();
    await p.evaluate(() => TM.leilaoSessao.acelerar(0.15));
    await ate(p, () => { const V = TM.leilaoSessao.atual().ver(); return V.lote && !V.lote.pausa; }, null, 30000);
    await nadaSobreNada(p, "lote", async (p, w, h) => p.evaluate(async () => {
      const barra = document.querySelector(".lei-lance").getBoundingClientRect(), rel = document.querySelector(".lei-relogio").getBoundingClientRect();
      const arco = document.querySelector(".lei-rel-arco"), d0 = arco.style.strokeDashoffset;
      await new Promise(r => setTimeout(r, 450));
      const l1 = [...document.querySelectorAll(".lei-l1 .lei-lb")].map(b => Math.round(b.getBoundingClientRect().height));
      return { barraVisivel: barra.top >= 0 && barra.bottom <= innerHeight + 1 && barra.height > 40, relVisivel: rel.top >= 0 && rel.bottom <= barra.top + 0.5,
        roda: arco.style.strokeDashoffset !== d0, l1min: Math.min(...l1) };
    }));
    await p.evaluate(() => document.querySelectorAll('.lei-bloco-bt[aria-expanded="false"]').forEach(b => b.click()));
    await espera(200);
    await nadaSobreNada(p, "lote-blocos", async p => p.evaluate(() => {
      const pt = document.querySelector(".lei-bloco .lei-pitch"), r = pt && pt.getBoundingClientRect();
      return { blocos: document.querySelectorAll('.lei-bloco-bt[aria-expanded="true"]').length, campinho: r ? Math.round(r.width) : 0, cartas: document.querySelectorAll(".lei-bloco .lei-pitch .ut-card").length };
    }));
    const blocos = nadaSobre.filter(x => /^lote-blocos/.test(x.tela));
    confere("T4 com os blocos abertos (Seu time, Técnicos, Próximos lotes): o campinho do lote medido nos 8 tamanhos", blocos.length === 8 && blocos.every(x => x.blocos === 3 && x.campinho > 100 && x.cartas === 11), blocos.map(x => ({ t: x.tela, b: x.blocos, c: x.campinho, n: x.cartas })));
    await p.evaluate(() => document.querySelectorAll('.lei-bloco-bt[aria-expanded="true"]').forEach(b => b.click()));
    const ruins = nadaSobre.filter(x => x.sobre.length || x.encostam.length || x.saem.length || x.fora.length || x.rolaLado || x.atras);
    confere(`T4 nada sobre nada (nem encostado, nem texto fora do botão): Entrada, Criar e Leilão (blocos fechados e abertos) nos 8 tamanhos (${nadaSobre.length} telas, ${nadaSobre.reduce((s, x) => s + x.n, 0)} clicáveis e cartões)`, !ruins.length, ruins.slice(0, 6));
    const lotes = nadaSobre.filter(x => /^lote /.test(x.tela));
    confere("T4 a barra de lance à vista com o relógio rodando nos 8 tamanhos (também 844×390 e 360×740), o relógio acima dela, linha 1 com ≥ 48 px",
      lotes.length === 8 && lotes.every(x => x.barraVisivel && x.relVisivel && x.roda && x.l1min >= 48), lotes.map(x => ({ t: x.tela, b: x.barraVisivel, r: x.relVisivel, roda: x.roda, h: x.l1min })));
    // "Vendido para X por R$ Y" (ou "Sem lance") na pausa entre os lotes
    await p.evaluate(() => TM.leilaoSessao.acelerar(1.5));
    const sAntes = (await ver(p)).lote.seq;
    await ate(p, s => { const V = TM.leilaoSessao.atual().ver(); return V.lote && V.lote.seq !== s; }, sAntes, 30000);
    await p.evaluate(() => TM.leilaoSessao.acelerar(0.2));
    await espera(150);
    const vendido = await p.evaluate(() => { const e = document.querySelector(".lei-vendido"); return { visivel: !!e && !e.hidden && e.offsetParent !== null, txt: e && e.lastElementChild && e.lastElementChild.textContent, botoes: [...document.querySelectorAll(".lei-l1 .lei-lb")].every(b => b.disabled) }; });
    confere("T4 na pausa, 'Vendido para X por R$ Y' (ou 'Sem lance') por cima da carta nova, com os botões apagados", vendido.visivel && /^(Vendido para .+ por R\$ \d+|Sem lance)/.test(vendido.txt) && vendido.botoes, vendido);
    await print(p, "4-vendido");
    // tema claro
    await p.evaluate(() => TM.ui.applyTheme("light"));
    await espera(300);
    const claro = await p.evaluate(() => {
      const lum = c => { const m = c.match(/\d+(\.\d+)?/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
      const cs = s => getComputedStyle(document.querySelector(s));
      return { barra: lum(cs(".lei-lance").backgroundColor), meu: lum(cs(".lei-meu").backgroundColor), texto: lum(cs(".lei-meu-clube").color),
        abaOn: cs(".lei-aba.on").backgroundImage !== "none", tudo: cs(".lei-lb-tudo").backgroundImage !== "none", sb: lum(cs(".lei-sb").backgroundColor) };
    });
    const contraste = await p.evaluate(() => {
      const rgb = c => c.match(/[\d.]+/g).map(Number);
      const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const L = c => { const m = rgb(c); return 0.2126 * lin(m[0]) + 0.7152 * lin(m[1]) + 0.0722 * lin(m[2]); };
      const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const fundo = getComputedStyle(document.body).backgroundColor, barra = "rgb(255, 255, 255)";
      const m = document.querySelector(".lei-lance-msg"), cls0 = m.className, out = {};
      for (const k of ["ok", "alerta", "erro"]) { m.className = "lei-lance-msg " + k; out[k] = Math.round(cr(getComputedStyle(m).color, barra) * 100) / 100; }
      m.className = cls0;
      const pen = document.createElement("span"); pen.className = "lei-esc-pen"; document.querySelector(".lei-corpo").appendChild(pen);
      out.pen = Math.round(cr(getComputedStyle(pen).color, fundo) * 100) / 100; pen.remove();
      return out;
    });
    confere("T4 tema claro: o retorno e o motivo da barra (ok, alerta, erro) e o '−N fora da função' com contraste ≥ 4,5:1", Object.values(contraste).every(x => x >= 4.5), contraste);
    const sClaro = await sobreposicao(p);
    await print(p, "4-claro");
    confere("T4 tema claro: barra, caixas e botões claros, texto escuro, a aba ativa e o Tudo em verde; nada sobre nada",
      claro.barra > 0.9 && claro.meu > 0.9 && claro.sb > 0.9 && claro.texto < 0.3 && claro.abaOn && claro.tudo && !sClaro.sobre.length && !sClaro.encostam.length && !sClaro.saem.length && !sClaro.atras, { claro, sobre: sClaro.sobre.slice(0, 3), encostam: sClaro.encostam.slice(0, 3), saem: sClaro.saem.slice(0, 3) });
    await p.evaluate(() => TM.ui.applyTheme("dark"));

    /* T5 a barra da sessão: Como funciona, Participantes e Vendas (folhas), e o relógio parado fora da sala */
    const folhas = [];
    for (const [rot, tit] of [["Como funciona", "Como funciona"], ["Participantes", "Participantes"], ["Vendas", "Vendas"]]) {
      await p.click(`.lei-sb[aria-label="${rot}"]`);
      await espera(250);
      const s = await p.evaluate(() => { const f = document.querySelector(".lei-folha"); return f ? { tit: f.querySelector(".lei-folha-tit").textContent, txt: f.innerText.replace(/\s+/g, " ").slice(0, 3000), foco: document.activeElement && document.activeElement.className } : null; });
      // aria-modal de verdade: a tela por trás inerte e o Tab (e o Shift+Tab) dando a volta dentro da folha
      const fora = [];
      for (let i = 0; i < 25; i++) { await p.keyboard.press(i < 19 ? "Tab" : "Shift+Tab"); const q = await p.evaluate(() => { const a = document.activeElement; return a && a.closest(".lei-folha-in") ? null : (a ? a.tagName + "." + a.className : "nada"); }); if (q) fora.push(q); }
      const inerte = await p.evaluate(() => document.querySelector("#app > .screen").inert);
      await p.keyboard.press("Escape");
      await espera(150);
      const solta = await p.evaluate(() => !document.querySelector("#app > .screen").inert);
      folhas.push({ rot, ok: !!s && s.tit === tit && !(await p.evaluate(() => !!document.querySelector(".lei-folha"))), modal: !fora.length && inerte && solta, fora: fora.slice(0, 3), s: s && { tit: s.tit, foco: s.foco } , txt: s && s.txt });
    }
    confere("T5 Como funciona, Participantes e Vendas abrem como folhas (foco no Fechar) e fecham com Esc", folhas.every(f => f.ok) && /R\$ 100/.test(folhas[0].txt) && /Bot /.test(folhas[1].txt) && /Vendidos/i.test(folhas[2].txt), folhas.map(f => ({ rot: f.rot, ok: f.ok, s: f.s })));
    confere("T5 as folhas prendem o foco: a tela por trás inerte enquanto abertas, o Tab e o Shift+Tab não saem da folha", folhas.every(f => f.modal), folhas.map(f => ({ rot: f.rot, modal: f.modal, fora: f.fora })));
    // o foco do teclado nunca atrás da barra de lance fixa (scroll-padding), no celular em pé
    const focoTapado = [];
    for (const [w, h] of [[390, 844], [360, 740]]) {
      await p.setViewportSize({ width: w, height: h });
      await espera(250);
      await p.evaluate(() => { if (document.activeElement) document.activeElement.blur(); scrollTo(0, 0); });
      for (let i = 0; i < 28; i++) {
        await p.keyboard.press("Tab");
        const r = await p.evaluate(() => { const a = document.activeElement, b = document.querySelector(".lei-lance"); if (!a || a === document.body || !b || b.hidden || b.contains(a)) return null;
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.bottom > rb.top + 1 ? (a.getAttribute("aria-label") || a.textContent).trim().slice(0, 30) + " " + Math.round(ra.top) + "–" + Math.round(ra.bottom) + " (barra em " + Math.round(rb.top) + ")" : null; });
        if (r) focoTapado.push(w + "x" + h + ": " + r);
      }
    }
    await p.setViewportSize({ width: 390, height: 844 });
    confere("T5 o Tab pela aba Leilão nunca deixa o foco atrás da barra de lance (390×844 e 360×740)", !focoTapado.length, focoTapado.slice(0, 4));
    // a linha da barra de lance: os textos mais longos (o retorno, os motivos, a troca de formação) cabem em 360 px; o campo de
    // outro valor com o máximo no lugar reservado
    await p.setViewportSize({ width: 360, height: 740 });
    await espera(250);
    const linha = await p.evaluate(() => {
      const S = TM.leilaoSessao.atual();
      S._emite("formacao", { de: "4-4-2", para: "4-2-4" });
      const m = document.querySelector(".lei-lance-msg"), mede = () => { const r = document.createRange(); r.selectNodeContents(m); return r.getBoundingClientRect().width; };
      const out = { formacao: m.textContent, larg: m.clientWidth, cabe: mede() <= m.clientWidth + 0.5, longos: [] };
      const txt0 = m.textContent;
      const textos = ["Lance de R$ 100: você lidera", "Alguém chegou antes: R$ 100", "Esse jogador já fechou", "Não deu para dar o lance", "Toque de novo para confirmar R$ 100",
        "Digite o valor do lance", "Você passou neste jogador", "Seu máximo neste jogador: R$ 100", "Aguarde o próximo jogador"]
        .concat(["max", "goleiro", "posicao", "completo", "lider", "passou", "pausa", "tarde", "fim", "valor", "antes", "fechado"].map(k => TM.leilaoSessao.textoMotivo(k, { max: 100, valor: 100 })));
      textos.forEach(t => { m.textContent = t; const w = mede(); if (w > m.clientWidth + 0.5) out.longos.push(t + " (" + Math.round(w) + " px)"); });
      m.textContent = txt0;
      const v = document.querySelector(".lei-valor"), cs = getComputedStyle(v), cv = document.createElement("canvas").getContext("2d");
      cv.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      const livre = v.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      out.placeholder = { txt: "Até R$ 100", larg: Math.round(cv.measureText("Até R$ 100").width), livre: Math.round(livre), real: v.placeholder };
      return out;
    });
    await p.setViewportSize({ width: 390, height: 844 });
    confere("T5 em 360 px a linha da barra de lance mostra inteiros o aviso da formação e os outros textos, e o campo de outro valor o máximo ('Até R$ X')",
      /^Formação agora é 4-2-4/.test(linha.formacao) && linha.cabe && !linha.longos.length && linha.placeholder.larg <= linha.placeholder.livre && /^(Até R\$ \d+|Outro valor)$/.test(linha.placeholder.real), linha);
    await p.evaluate(() => TM.leilaoSessao.acelerar(2));
    await p.click(".lei-cab .tb-back");
    await espera(400);
    const fora = await p.evaluate(async () => { const S = TM.leilaoSessao.atual(), h0 = S.hora(); await new Promise(r => setTimeout(r, 600)); return { rota: TM.ui.current(), parado: S.pausado(), andou: S.hora() - h0, txt: document.querySelector(".screen.is-active").innerText.replace(/\s+/g, " ") }; });
    confere("T5 voltar à Entrada no meio do treino para o relógio ('Leilão em andamento' com 'Voltar à sala')", fora.rota === "leilao" && fora.parado && fora.andou === 0 && /Leilão em andamento/i.test(fora.txt) && /Voltar à sala/.test(fora.txt), fora);
    await clica(p, "^Voltar à sala$");
    await espera(400);
    const volta = await p.evaluate(async () => { const S = TM.leilaoSessao.atual(), h0 = S.hora(); await new Promise(r => setTimeout(r, 300)); return { rota: TM.ui.current(), parado: S.pausado(), andou: S.hora() - h0 }; });
    confere("T5 'Voltar à sala' volta à aba Leilão com o relógio andando", volta.rota === "leilao-lote" && !volta.parado && volta.andou > 0, volta);

    /* T6 recarregar no meio volta ao mesmo lote, com o tempo que faltava */
    await p.evaluate(() => TM.leilaoSessao.acelerar(1));
    await ate(p, () => { const S = TM.leilaoSessao.atual(), V = S.ver(); return V.lote && !V.lote.pausa && V.lote.fim - S.hora() > 4000; }, null, 30000);
    const antesR = await p.evaluate(() => { const S = TM.leilaoSessao.atual(), V = S.ver(); return { codigo: S.codigo, seq: V.lote.seq, ordem: V.lote.ordem, i: V.lote.i, resta: V.lote.fim - S.hora(), saldo: V.tecnicos[V.eu].saldo }; });
    await p.reload({ waitUntil: "load" });
    await p.waitForFunction(() => window.TM && TM.ui && TM.leilaoSessao && TM.leilaoTela, null, { timeout: 60000 });
    await p.evaluate(() => TM.ui.go("leilao"));
    await espera(300);
    const minhas = await p.evaluate(() => ({ atual: !!TM.leilaoSessao.atual(), salas: TM.leilaoSessao.salas().map(x => x.codigo), txt: (document.querySelector(".lei-salas") || {}).innerText }));
    await clica(p, "^Continuar$");
    await ate(p, () => TM.ui.current() === "leilao-lote" && !!TM.leilaoSessao.atual(), null, 20000);
    const depoisR = await p.evaluate(() => { const S = TM.leilaoSessao.atual(), V = S.ver(); return { codigo: S.codigo, seq: V.lote.seq, ordem: V.lote.ordem, i: V.lote.i, resta: V.lote.fim - S.hora(), saldo: V.tecnicos[V.eu].saldo, n: document.querySelector(".lei-lote-n").textContent }; });
    confere("T6 recarregar no meio: 'Minhas salas' lista o treino; 'Continuar' volta ao mesmo lote com o tempo que faltava (±1,5 s)",
      !minhas.atual && minhas.salas.includes(antesR.codigo) && depoisR.codigo === antesR.codigo && depoisR.seq === antesR.seq && depoisR.i === antesR.i && depoisR.saldo === antesR.saldo
      && Math.abs(depoisR.resta - antesR.resta) <= 1500 && depoisR.n === "Jogador " + antesR.ordem + " de 52", { minhas, antesR, depoisR });

    /* T7 o resto do leilão (o relógio acelerado; quem decide é a pessoa de teste pela tela) */
    await p.evaluate(() => TM.leilaoSessao.acelerar(10));
    const amostras = { motivos: {}, ruins: [] };
    const t7 = Date.now();
    while (Date.now() - t7 < 240000) {
      const r = await p.evaluate(async () => {
        const S = TM.leilaoSessao.atual(); if (!S) return { fim: true };
        let V = S.ver();
        if (V.estado !== "leilao") { TM.leilaoSessao.acelerar(0.1); return { fim: true, estado: V.estado }; }
        if (!V.lote || V.lote.pausa || V.lote.fechando) return {};
        const msg = document.querySelector(".lei-lance-msg"), b1 = document.querySelector('.lei-lb-passo[data-tipo="+1"]'), pas = document.querySelector(".lei-lb-passar");
        const out = {};
        // o +1 apagado: a linha de cima diz o motivo (quando não há retorno de toque na tela); amostra só com o estado parado
        // por dois quadros (a tela se refaz no quadro seguinte ao do estado novo)
        if (V.botoes && !V.botoes["+1"].pode) {
          const m1 = V.botoes["+1"].motivo, k1 = V.lote.seq + ":" + V.lote.n;
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const V2 = S.ver();
          if (V2.estado === "leilao" && V2.lote && !V2.lote.pausa && !V2.lote.fechando && V2.botoes && !V2.botoes["+1"].pode && V2.botoes["+1"].motivo === m1 && V2.lote.seq + ":" + V2.lote.n === k1
            && b1.disabled && !/lidera:|chegou antes|passou neste|já fechou|Lance de|Formação agora|confirmar/.test(msg.textContent)) out.amostra = [m1, msg.textContent];
          V = V2;
          if (!V.botoes) return out;
        }
        const eu = V.tecnicos[V.eu];
        if (V.botoes && V.botoes["+1"].pode && !b1.disabled && eu.vagas > 0 && V.botoes["+1"].alvo <= Math.max(1, Math.floor(eu.saldo / eu.vagas))) b1.click();
        else if (V.botoes && V.botoes.passar.pode && !pas.disabled && Math.random() < 0.7) pas.click();
        return out;
      });
      if (r.fim) break;
      if (r.amostra) {
        amostras.motivos[r.amostra[0]] = (amostras.motivos[r.amostra[0]] || 0) + 1;
        const esperado = (textoMotivos.find(x => x[0] === r.amostra[0]) || [])[1];
        if (!esperado || (r.amostra[0] === "max" ? !/^Acima do seu máximo R\$ \d+$/.test(r.amostra[1]) : r.amostra[1] !== esperado)) amostras.ruins.push(r.amostra);
      }
      await espera(70);
    }
    V = await ver(p);
    const n7 = Object.values(amostras.motivos).reduce((s, x) => s + x, 0);
    confere("T7 o leilão vai até o fim pela tela; sempre que o +1 apaga, a linha de cima diz o motivo (com o de goleiro/posição/máximo/completo entre eles)",
      V.estado !== "leilao" && n7 > 10 && !amostras.ruins.length && Object.keys(amostras.motivos).some(k => /goleiro|posicao|max|completo/.test(k)), { estado: V.estado, motivos: amostras.motivos, ruins: amostras.ruins.slice(0, 5) });
    const an = await p.evaluate(() => TM.leilaoTela.anuncios());
    confere("T7 a região ao vivo falou o lote ('Jogador N de 52: nome, função, nota') e as vendas", an.some(a => /^Jogador \d+ de 52: .+, .+, nota \d+$/.test(a)) && an.some(a => /^Vendido para .+ por R\$ \d+$/.test(a)), an.slice(-6));
    // o que ficou de fato na #lei-vivo: o "Vendido para X por R$ Y" fica escrito (antes, o lote novo o trocava no mesmo quadro) e
    // nenhuma fala sai antes de 1 s
    const vivo = await p.evaluate(() => { const v = window.__vivo || [], falas = [];
      // (a última fala ainda está na região: o tempo dela não conta)
      for (let i = 0; i + 1 < v.length; i++) if (v[i][1]) falas.push({ t: v[i][1], ms: Math.round(v[i + 1][0] - v[i][0]) });
      return { n: falas.length, vendidos: falas.filter(f => /Vendido para .+ por R\$ \d+/.test(f.t)).length, curtas: falas.filter(f => f.ms < 1000).map(f => f.t.slice(0, 60) + " (" + f.ms + " ms)"),
        amostra: falas.filter(f => /Vendido/.test(f.t)).slice(-2).map(f => f.t.slice(0, 120) + " (" + f.ms + " ms)") }; });
    confere("T7 na #lei-vivo o 'Vendido para X por R$ Y' fica escrito (junto com o lote novo) e cada fala fica pelo menos 1 s", vivo.n > 10 && vivo.vendidos > 3 && !vivo.curtas.length, vivo);

    /* T8 a escalação (a aba abre sozinha no fim do leilão) */
    const foiEsc = await ate(p, () => TM.ui.current() === "leilao-escalacao", null, 15000);
    await espera(300);
    V = await ver(p);
    const esc = await p.evaluate(() => ({ cartas: document.querySelectorAll(".lei-pitch-esc .ut-card:not(.empty)").length, vagas: document.querySelectorAll('.lei-pitch-esc .lei-vaga[role="button"]').length,
      n: document.querySelector(".lei-esc-n").textContent, prazo: (document.querySelector(".lei-esc-prazo") || {}).textContent }));
    confere("T8 no fim do leilão a aba Escalação abre sozinha: 11/11, o campinho com as 11 cartas tocáveis e o prazo",
      foiEsc && V.estado === "escalacao" && V.meu.escalacao.n === 11 && esc.cartas === 11 && esc.vagas === 11 && esc.n === "11/11" && /A escalação fecha em \d:\d\d/.test(esc.prazo || ""), { foiEsc, estado: V.estado, esc });
    await nadaSobreNada(p, "escalacao");
    const ruinsEsc = nadaSobre.filter(x => /^escalacao/.test(x.tela) && (x.sobre.length || x.encostam.length || x.saem.length || x.fora.length || x.rolaLado));
    confere("T8 nada sobre nada na Escalação nos 8 tamanhos", !ruinsEsc.length, ruinsEsc.slice(0, 4));
    // trocar duas vagas do mesmo grupo
    const par = await p.evaluate(() => { const V = TM.leilaoSessao.atual().ver(), e = V.meu.escalacao, sl = TM.leilao.slotsDe(e.formacao);
      for (let i = 0; i < sl.length; i++) for (let j = i + 1; j < sl.length; j++) if (sl[i][0] === sl[j][0] && sl[i][0] !== "GK") return { i, j, ti: e.tit[i], tj: e.tit[j] }; return null; });
    await p.click(`.lei-pitch-esc .lei-vaga[data-vaga="${par.i}"]`);
    await espera(150);
    const marcada = await p.evaluate(i => !!document.querySelector(`.lei-pitch-esc .lei-vaga.sel[data-vaga="${i}"]`), par.i);
    await p.click(`.lei-pitch-esc .lei-vaga[data-vaga="${par.j}"]`);
    await espera(300);
    V = await ver(p);
    confere("T8 tocar em dois troca as vagas (a 1ª fica marcada); vale a escalação à mão", marcada && V.meu.escalacao.manual && V.meu.escalacao.tit[par.i] === par.tj && V.meu.escalacao.tit[par.j] === par.ti, { par, marcada, tit: V.meu.escalacao.tit });
    // a formação (só as que cabem)
    const forma = await p.evaluate(() => { const bs = [...document.querySelectorAll(".lei-esc-formas .lei-forma-bt")]; const alvo = bs.find(b => !b.disabled && !b.classList.contains("active"));
      const off = bs.filter(b => b.disabled).map(b => b.title); if (alvo) alvo.click(); return { alvo: alvo && alvo.querySelector(".lei-forma-f").textContent, off }; });
    await espera(300);
    V = await ver(p);
    confere("T8 a formação troca para uma em que o time cabe (as que não cabem ficam apagadas com o motivo)",
      // (o time pode caber numa formação só: então todas as outras estão apagadas com o motivo)
      (forma.alvo ? V.meu.escalacao.formacao === forma.alvo : forma.off.length === 5) && forma.off.every(t => /não cabe/.test(t)), { forma, agora: V.meu.escalacao.formacao });
    await print(p, "8-escalacao");
    // Pronto → o campeonato (em breve)
    await clica(p, "^Pronto$");
    await ate(p, () => TM.leilaoSessao.atual().ver().estado === "camp", null, 15000);
    await p.click('.lei-aba[data-rota="leilao-camp"]');
    await espera(300);
    const camp = await p.evaluate(() => ({ rota: TM.ui.current(), estado: TM.leilaoSessao.atual().ver().estado, txt: document.querySelector(".screen.is-active").innerText.replace(/\s+/g, " "),
      feitas: [...document.querySelectorAll(".lei-aba.feita")].map(b => b.dataset.rota) }));
    confere("T8 'Pronto' leva ao campeonato: a aba Campeonato diz 'Campeonato em breve'; Leilão e Escalação com o check",
      camp.rota === "leilao-camp" && camp.estado === "camp" && /Campeonato em breve/i.test(camp.txt) && camp.feitas.join() === "leilao-lote,leilao-escalacao", camp);
    await print(p, "8-campeonato");

    /* T9 Sair da sala (com confirmação) apaga o treino deste aparelho */
    await p.click(".lei-sb.sair");
    await espera(250);
    await p.evaluate(() => { const b = [...document.querySelectorAll(".sheet-overlay .sheet-item")].find(x => x.textContent.trim() === "Sair da sala"); if (b) b.click(); });
    await ate(p, () => TM.ui.current() === "leilao", null, 10000);
    const saiu = await p.evaluate(() => ({ atual: !!TM.leilaoSessao.atual(), salas: TM.leilaoSessao.salas().length }));
    confere("T9 'Sair da sala' pede confirmação, volta à Entrada e apaga o treino", !saiu.atual && saiu.salas === 0, saiu);
  } catch (e) {
    confere("exceção no teste de tela", false, String(e && e.stack || e).slice(0, 1500));
  } finally {
    await nav.close().catch(() => {});
    await srv.fechar();
  }
  confere("nenhum erro de página nem no console", !errosPagina.length, errosPagina.slice(0, 6));
  console.log(`${falhasT.length ? "REPROVOU" : "PASSOU"}: ${oks.length} de ${oks.length + falhasT.length} itens da tela em ${((performance.now() - t0) / 1000).toFixed(1)} s (prints em ${PASTA})`);
  return falhasT.length ? 1 : 0;
}
