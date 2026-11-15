#!/usr/bin/env node
/* Testes do Modo Leilão (PLANO-LEILAO.md §4.1), em Node, sem navegador e sem rede.
   Carrega num `vm` o rng.js, o data.js (com um TM.storage falso), o viverde.js, o competitions.js, o ultimate.js (as
   listas do escudo desenhado; o TM.ui de mentira) e os arquivos do leilão, nas duas edições (pública e pro), e roda:
     L1 lotes · L2 ordem · L3 lance · L4 relógio · L5 fechar · L6 fim · L7 robôs · L8 protocolo (o leilão inteiro
     pela sessão e pela rede em memória = a máquina pura) · L9 formações e escalação · L10 conferência ·
     R a rede em memória · S a sessão (botões, motivos, formação, escalação, recarregar, sair, Minhas salas) ·
     F a rede firebase() sobre o banco falso que se comporta como o SDK compat (ferramentas/lib/banco-falso.mjs): a mesma
     bateria do R, a transação pelo cache, a hora pela testemunha, o ack perdido, a fila sem conexão, o onDisconnect ·
     O o leilão ONLINE: as sessões (criarSala, entrar, abrir) pela firebase() sobre o banco falso em 2, 4 e 8 "aparelhos"
     (a sala por transação, as recusas, o leilão inteiro igual em todos, o relógio ±5 s, o que pula e o que dorme, quem cai,
     quem some, o ack perdido, o lance velho, recarregar, outra aba, a presença, passar o clube, a limpeza, a sala mexida —
     o vivo apagado, os lotes trocados, a edição trocada — e a volta da página sem derrubar a conexão do TM); o servidor
     falso confere cada gravação do vivo: nenhum lote fecha antes do fim, nenhum lance entra depois ·
     C o campeonato (PR 3; TM.leilaoCamp e o motor): C1 o calendário dos 3 formatos (T de 2 a 8), C2 a tabela com o
     desempate total (contra a conta feita no teste, com as chaves embaralhadas), C3 a chave com as folgas, C4 o gol de ouro,
     C5 a mesma semente = o mesmo resultado (também noutro "aparelho"), C6 os classificados do misto, C7 o semLesao e o motor
     SEM a opção igual ao de antes (contra a origin/main quando o git a tem e sempre contra a referência gravada em
     ferramentas/dados/motor-ref.json), C8 a máquina do jogo (aberto → reservado → feito, o prazo, o W.O., a conferência e o
     campeonato inteiro por 3 "aparelhos" ao mesmo tempo na rede em memória) ·
     K o campeonato pela SESSÃO (leilao-sessao.js): K0 a duração estimada e o formato, K1 o treino com 1 pessoa e 1–7 bots
     nos 3 formatos até o campeão (o prazo de 2 min no jogo da pessoa, o Simular que grava antes de responder, cada jogo
     reservado e gravado uma vez e conferido, a mesma vista noutro "aparelho"), K2 recarregar no meio = os mesmos
     resultados, K3 a escalação mudada vale a partir do próximo jogo que não começou, K4 a sala adulterada congela ·
     KO o campeonato ONLINE pela firebase() sobre o banco falso (2, 4 e 8 aparelhos; a limpeza; as regras opcionais do
     firebase/regras-leilao-validate.json avaliadas em cada gravação: nenhuma honesta recusada, as adulterações recusadas)
   Uma linha por bloco; o código de saída é 1 se algum reprovar.
   Uso: node ferramentas/testar-leilao.mjs [--so L1,L7] [--leiloes 1000] [-v] [--rapido] [--caso O1,O4,quatro]
   (o --caso também escolhe os do KO: dois, limpeza, quatro, oito)
   --gravar-motor [arquivo]: regrava a referência do motor do C7 (padrão: o js/engine.js da origin/main, pelo git) — só
   quando o motor mudou DE PROPÓSITO (dizer no PR)
   (--rapido: o leilão online de 8 até a metade e sem o da queda; --caso: só esses pedaços do O; LEILAO_DEPURA=1 mostra
   o andamento do O)
   --tela: o navegador num aparelho (§4.2; o Chromium do Playwright, o TM servido daqui, o relógio do treino acelerado pelo
   gancho da sessão): "Mais modos" com 13 atalhos, o treino inteiro com 3 bots (os botões, os apagados com o motivo, o Tudo
   de dois toques, passar, outro valor), recarregar no meio, a escalação, nada sobre nada nos 8 tamanhos, a barra de lance à
   vista com o relógio rodando, o tema claro, o Formato na Criar, o campeonato no treino pela tela (os 3 formatos até o
   campeão: Seu jogo com o prazo, o Simular partida que grava antes de mostrar, o Ver o jogo no 2D sem pausa com a
   prorrogação do gol de ouro e os pênaltis gravados, a tabela, a chave com folgas, o fim) nos 8 tamanhos, no escuro e no
   claro, e nenhum erro no console. Uso: node ferramentas/testar-leilao.mjs --tela [--prints <pasta>]. Nenhum teste usa o
   Firebase: o SDK do gstatic é trocado por um vazio. */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { avaliadorRegras } from "./lib/regras-leilao.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n, p) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : p; };
const SO = opt("--so", null) ? opt("--so").split(",").map(s => s.trim().toUpperCase()) : null;
const N_LEILOES = +opt("--leiloes", 1000);
const VERBOSO = args.includes("-v");
if (args.includes("--tela")) process.exit(await testeTela());
const ARQS = ["js/rng.js", "js/data.js", "js/viverde.js", "js/competitions.js", "js/ultimate.js", "js/engine.js", "js/leilao.js", "js/leilao-camp.js", "js/leilao-rede.js", "js/leilao-sessao.js"];
const REF_MOTOR = path.join(RAIZ, "ferramentas/dados/motor-ref.json");
if (args.includes("--gravar-motor")) process.exit(gravarMotor());

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

/* ============================== a bateria comum das redes (R na memória, F no Firebase falso) ==============================
   M: rede, agora(), avanca(ms) (o tempo de mentira anda e o que estava marcado acontece), outro(latencia) (outro aparelho
   na MESMA sala), cair(rede)/voltar(rede) (a conexão daquele aparelho), arvore() (a sala no servidor), tolTS (o quanto o
   carimbo devolvido pela transação pode ficar longe da hora do servidor: no online é a estimativa local). */
async function bateriaRede(ok, M) {
  const { rede } = M, TS = rede.TS;
  // espera a promessa andando o tempo (o que ela pede ao "servidor" leva a latência)
  const ja = async (p, ms = 200) => { await M.avanca(ms); return p; };
  const vistos = [];
  const para = rede.ouvir("vivo", v => vistos.push(v));
  await M.avanca(0);
  ok(vistos.length === 1 && vistos[0] === null, "ouvir entrega o valor de agora (null): " + JSON.stringify(vistos));
  // a transação com o carimbo da hora e sem campos vazios
  const t0 = M.agora();
  let r = await ja(rede.transacao("vivo", cur => cur === null ? { seq: 1, t: TS, h: [], p: "00", sem: [], lider: -1 } : undefined));
  await M.avanca(0);
  const noServidor = (M.arvore() || {}).vivo || {};
  ok(r.feito && Math.abs(r.valor.t - t0) <= M.tolTS && noServidor.t === t0 && !("h" in r.valor) && !("sem" in r.valor) && r.valor.lider === -1 && !("h" in noServidor),
    "transação: carimbo resolvido e vazios fora: " + JSON.stringify(r.valor) + " no servidor " + JSON.stringify(noServidor));
  ok(vistos.length === 2 && vistos[1].seq === 1 && vistos[1].t === t0, "o ouvinte viu a transação (uma vez, com a hora do servidor): " + JSON.stringify(vistos));
  r = await ja(rede.transacao("vivo", cur => cur === null ? { seq: 9 } : undefined));
  ok(!r.feito && r.valor && r.valor.seq === 1, "transação abortada devolve o atual: " + JSON.stringify(r));
  // atualizar em vários caminhos e gravar null apaga
  await ja(rede.atualizar("", { "escal/0": { formacao: "4-4-2" }, "escal/1": { formacao: "4-3-3", pronto: true } }));
  ok((await ja(rede.ler("escal/1/formacao"))) === "4-3-3", "atualizar com caminhos");
  await ja(rede.gravar("escal/0", null));
  ok((await ja(rede.ler("escal/0"))) === null && (await ja(rede.ler("escal/1"))) !== null, "gravar null apaga");
  await ja(rede.gravar("escal/1", null));
  ok(!("escal" in (M.arvore() || {})), "o pai vazio some");
  // dois aparelhos no mesmo banco, com latência e transações concorrentes
  const b = M.outro(30);
  await M.avanca(100);
  const p1 = b.transacao("cont", c => (c || 0) + 1), p2 = rede.transacao("cont", c => (c || 0) + 1), p3 = b.transacao("cont", c => (c || 0) + 1);
  await M.avanca(1000);
  await Promise.all([p1, p2, p3]);
  ok((await ja(rede.ler("cont"))) === 3, "três transações concorrentes somam 3");
  // a queda: a operação espera a volta; aoCair e aoVoltar avisam
  let caiu = 0, voltou = 0; b.aoCair(() => caiu++); b.aoVoltar(() => voltou++);
  M.cair(b);
  await M.avanca(0);
  ok(!b.conectado() && caiu === 1, "aoCair e conectado");
  let feito = false; const p4 = b.gravar("x", 1).then(() => { feito = true; });
  await M.avanca(100);
  ok(!feito && (await ja(rede.ler("x"))) === null, "sem conexão a gravação espera");
  M.voltar(b);
  await M.avanca(200); await p4;
  ok(feito && (await ja(rede.ler("x"))) === 1 && voltou === 1 && b.conectado(), "na volta a gravação vai (e aoVoltar avisa)");
  // o que o servidor faz quando a conexão cai (aoDesconectar): vale uma vez; cancelar tira
  await ja(b.gravar("pres/b/k1", true)); await ja(b.gravar("pres/b/k2", true));
  await ja(b.aoDesconectar("pres/b/k1").apagar());
  await ja(b.aoDesconectar("pres/b/k2").apagar());
  await ja(b.aoDesconectar("pres/b/k2").cancelar());
  const vp = []; const paraP = rede.ouvir("pres", v => vp.push(v));
  await M.avanca(100);
  M.cair(b); await M.avanca(100);
  ok(JSON.stringify(vp[vp.length - 1]) === JSON.stringify({ b: { k2: true } }), "aoDesconectar: o servidor apaga quando cai (o cancelado fica): " + JSON.stringify(vp));
  M.voltar(b); await M.avanca(200);
  await ja(b.gravar("pres/b/k1", true));
  M.cair(b); await M.avanca(100);
  ok((await ja(rede.ler("pres/b/k1"))) === true, "aoDesconectar vale uma vez (na volta, rearme)");
  M.voltar(b); await M.avanca(200);
  // a testemunha da hora: a hora que o servidor pôs
  const tb = M.agora();
  const tw = await ja(rede.testemunha("bate/eu", { sid: "s1" }));
  const bate = await ja(rede.ler("bate/eu"));
  ok(typeof tw === "number" && Math.abs(tw - tb) <= M.tolTS && bate && bate.ts === tw && bate.sid === "s1", "testemunha: a hora do servidor (" + (tw - tb) + " ms) e o que gravou " + JSON.stringify(bate));
  paraP(); para();
  return b;
}

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
  await bateriaRede(ok, {
    rede, tolTS: 0, agora: () => hora,
    // anda até cada coisa marcada (na hora dela) e só então até o fim
    avanca: async ms => {
      const alvo = hora + ms;
      for (let i = 0; i < 10000; i++) {
        await roda();
        agendaFila.sort((a, b) => a.at - b.at);
        if (!agendaFila.length || agendaFila[0].at > alvo) break;
        hora = Math.max(hora, agendaFila[0].at);
      }
      hora = alvo; await roda();
    },
    outro: lat => rede.outroCliente({ latencia: lat }),
    cair: b => b._cair(), voltar: b => b._voltar(),
    arvore: () => rede._arvore()
  });
  // a gravação no aparelho: outra rede com o mesmo código volta ao mesmo ponto
  hora += 500; await roda();
  ok(guardado["leilao:sala:TREINO1"] && JSON.parse(guardado["leilao:salas"]).includes("TREINO1"), "gravou a sala e o índice");
  const volta = R.memoria("TREINO1", { relogio: () => hora, agendar, armazem });
  ok((await volta.ler("vivo")).seq === 1, "o treino volta depois de recarregar");
  ok(jsonIgual(R.salasGuardadas(armazem), ["TREINO1"]), "salasGuardadas");
  // reconectar: cai e volta (os dois avisos)
  let c2 = 0, v2 = 0; rede.aoCair(() => c2++); rede.aoVoltar(() => v2++);
  rede.reconectar();
  ok(c2 === 1 && v2 === 1 && rede.conectado(), "reconectar: cai e volta");
  rede.fechar();
  rede.apagar();
  ok(!guardado["leilao:sala:TREINO1"] && !guardado["leilao:salas"], "apagar some com a gravação");
  const ms = performance.now() - t0;
  console.log(`${erros.length ? "REPROVOU" : "ok      "} R    rede em memória: ouvir, transação, carimbo, vazios, gravação, concorrência, queda, aoDesconectar, testemunha (${(ms / 1000).toFixed(1)} s)`);
  if (erros.length) { falhas++; erros.forEach(e => console.log("         · " + e)); }
}

/* ============================================ F rede no Firebase (o banco falso) ============================================
   A rede firebase() do leilao-rede.js sobre o banco falso que se comporta como o SDK compat 10.12.5
   (ferramentas/lib/banco-falso.mjs): a MESMA bateria do R e o que só o online tem — a transação com o cache velho repete, a
   1ª rodada com o valor do servidor (o SDK rodaria com null e abortaria sem perguntar), o TIMESTAMP resolvido no servidor (a
   estimativa no valor devolvido), a hora pela testemunha de menor ida e volta (o relógio do aparelho ±5 s e pulando depois
   da calibração), o ack perdido ('desconectado' e o servidor gravou), a gravação sem conexão reenviada, o onDisconnect no
   servidor, a permissão recusada, a limpeza dos valores, o ouvir sempre depois, reconectar, apagar e a disputa de 4
   aparelhos. Nenhum Firebase de verdade. */
async function testeFirebase() {
  if (SO && !SO.includes("F")) return;
  const t00 = performance.now(), erros = [], notas = [];
  const ok = (c, m) => { if (!c) erros.push(m); return !!c; };
  const R = TMs.public.leilaoRede;
  const { BancoFalso } = await import(pathToFileURL(path.join(RAIZ, "ferramentas/lib/banco-falso.mjs")).href);
  // o tempo de mentira: o servidor, o agendador e os relógios dos aparelhos andam juntos
  const T = { hora: 1000, fila: [], seq: 0 };
  const agendar = (fn, ms) => { T.fila.push({ at: T.hora + Math.max(0, +ms || 0), fn, s: T.seq++ }); };
  const avanca = async (ms = 0) => {
    const alvo = T.hora + ms;
    const proximo = () => { T.fila.sort((a, b) => a.at - b.at || a.s - b.s); return T.fila.length && T.fila[0].at <= alvo; };
    for (let volta = 0; volta < 200000; volta++) {
      for (let i = 0; i < 3; i++) await new Promise(r => setImmediate(r));
      // as promessas em cadeia podem marcar mais coisa: espera mais um pouco antes de dar o tempo por andado
      if (!proximo()) { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); if (!proximo()) break; }
      const it = T.fila.shift(); T.hora = Math.max(T.hora, it.at); it.fn();
    }
    T.hora = Math.max(T.hora, alvo);
  };
  // espera a promessa andando o tempo (o pedido e a resposta levam a latência dos dois lados)
  const ja = async (p, ms = 400) => { await avanca(ms); return p; };
  const banco = new BancoFalso({ relogio: () => T.hora, tempo: () => T.hora, agendar });
  let nAparelho = 0;
  const redes = new Map();   // rede → o cid do cliente dela no banco falso
  // um aparelho: o cliente do banco falso (o SDK) + a rede firebase() da sala; desvio = o relógio de parede dele (±5 s)
  function aparelho(codigo, o = {}) {
    const cli = banco.cliente({ uid: o.uid || "u" + (++nAparelho), latencia: o.latencia ?? 0, relogio: () => T.hora + (o.desvio ? o.desvio() : 0) });
    const mono = { base: 50000 + nAparelho * 1000, pulo: 0 };
    const rede = R.firebase(codigo, { db: cli.db, firebase: cli.firebase, relogio: () => T.hora - 1000 + mono.base + mono.pulo, relogioParede: () => T.hora + (o.desvio ? o.desvio() : 0) });
    redes.set(rede, cli.cid);
    return { cli, rede, mono };
  }
  const sala = c => banco.ler("leiloes/" + c);
  try {

  /* F1 a mesma bateria do R */
  const A = aparelho("SALA1");
  await avanca(0);
  await bateriaRede(ok, {
    rede: A.rede, tolTS: 0, agora: () => T.hora, avanca,
    outro: lat => aparelho("SALA1", { latencia: lat }).rede,
    cair: rd => banco.derrubar(redes.get(rd)), voltar: rd => banco.conectar(redes.get(rd)),
    arvore: () => sala("SALA1")
  });

  /* F2 a transação: a 1ª rodada com o valor do servidor; o cache velho repete; a armadilha do SDK */
  banco.gravar("leiloes/SALA2/cont", 3);
  banco.gravar("leiloes/SALA2/novo", 3);
  const B = aparelho("SALA2", { latencia: { sobe: 10, desce: 120 } });
  await avanca(500);
  // o SDK puro (sem a rede): no caminho que ninguém ouve, a 1ª rodada vê null e a fn que aborta com null nem pergunta
  const viuSdk = [];
  let rs = await ja(B.cli.db.ref("leiloes/SALA2/cont").transaction(c => { viuSdk.push(c); return c == null ? undefined : c + 1; }, undefined, false));
  ok(viuSdk.length === 1 && viuSdk[0] === null && !rs.committed && sala("SALA2").cont === 3, "o SDK falso imita a armadilha: 1ª rodada com null aborta sem perguntar ao servidor " + JSON.stringify(viuSdk));
  // a rede: ouve antes, a fn vê o valor do servidor (num caminho que este aparelho nunca ouviu)
  const viuRede = [];
  let pr = B.rede.transacao("novo", c => { viuRede.push(c); return c == null ? undefined : c + 1; });
  await avanca(1000); let r = await pr;
  ok(r.feito && r.valor === 4 && viuRede[0] === 3 && sala("SALA2").novo === 4, "a rede: a 1ª rodada já com o valor do servidor " + JSON.stringify(viuRede));
  await ja(B.rede.transacao("cont", c => c + 1));   // o cont vai a 4, como o novo
  // o cache velho: B ouve, o servidor muda e o dado demora 120 ms a chegar; a transação de B repete com o valor de lá
  const vistosB = []; const paraB = B.rede.ouvir("cont", v => vistosB.push(v));
  await avanca(500);
  banco.gravar("leiloes/SALA2/cont", 10);
  const viuVelho = [];
  pr = B.rede.transacao("cont", c => { viuVelho.push(c); return (c || 0) + 1; });
  await avanca(2000); r = await pr;
  ok(r.feito && r.valor === 11 && viuVelho.join() === "4,10" && sala("SALA2").cont === 11, "o cache velho: o servidor recusa ('datastale') e a fn roda de novo com o valor de lá: " + viuVelho.join(" → "));
  ok(vistosB.join() === "4,10,11", "o ouvinte viu só valores do servidor (sem o líder falso do applyLocally): " + vistosB.join(","));
  paraB();
  // nenhuma escuta esquecida (a transação solta a dela)
  await new Promise(res => setTimeout(res, 10)); await avanca(100);
  ok(!B.cli.db.__falso.estado().escutas.length, "a transação não deixa escuta pendurada: " + JSON.stringify(B.cli.db.__falso.estado().escutas));

  /* F3 a hora: o TIMESTAMP no servidor, a estimativa no valor, a testemunha de menor ida e volta, o relógio que pula */
  let desvio = 5000;
  const H = aparelho("SALA3", { latencia: 40, desvio: () => desvio });
  await avanca(300);
  const offSdk = H.rede._hora().offsetSdk;
  ok(Math.abs(offSdk - (-5000 - 40)) < 1, "o .info/serverTimeOffset do aperto de mão: " + offSdk);
  ok(Math.abs(H.rede.horaServidor() - T.hora) <= 45, "antes da testemunha, a hora pelo aperto de mão (erro = a volta): " + (H.rede.horaServidor() - T.hora));
  const tTx = T.hora;
  pr = H.rede.transacao("x", c => ({ t: H.rede.TS, v: 1 }));
  await avanca(500); r = await pr;
  const srvX = sala("SALA3").x.t;
  ok(r.feito && srvX >= tTx && srvX <= tTx + 200 && Math.abs(r.valor.t - srvX) <= 100, `TIMESTAMP: o servidor pôs ${srvX - tTx} ms depois; a transação devolve a estimativa (${r.valor.t - srvX} ms de diferença)`);
  const tg = T.hora;
  await ja(H.rede.gravar("y", { t: H.rede.TS }));
  ok(typeof sala("SALA3").y.t === "number" && sala("SALA3").y.t === tg + 40, "gravar com o carimbo: a hora do servidor quando chegou (" + (sala("SALA3").y.t - tg) + " ms)");
  // as testemunhas (latências diferentes: vale a de menor ida e volta)
  const amostrasIda = [80, 15, 120, 40];
  for (const lat of amostrasIda) {
    banco.definirLatencia(H.cli.cid, lat);
    const s0 = T.hora; pr = H.rede.testemunha("bate/h", { sid: "h1" }); await avanca(lat * 4 + 50); const tw = await pr;
    ok(typeof tw === "number" && tw === s0 + lat, "a testemunha devolve a hora em que o servidor gravou (" + (tw - s0) + " ms, latência " + lat + ")");
    await avanca(400);   // o que ainda está no caminho (o fim da escuta da leitura) chega antes da próxima

  }
  const esc = H.rede._hora().escolhida;
  ok(esc && esc.ida === 30 && Math.abs(H.rede.horaServidor() - T.hora) <= 15.5, `a hora pela amostra de menor ida e volta (${esc && esc.ida} ms): erro ${(H.rede.horaServidor() - T.hora).toFixed(1)} ms`);
  // o relógio de parede pula +60 s depois da calibração: a hora não muda (o relógio monótono)
  desvio = 65000;
  ok(Math.abs(H.rede.horaServidor() - T.hora) <= 15.5, "o relógio de parede pula +60 s depois da calibração: a hora não muda");
  // o relógio monótono pula (o aparelho dormiu e ele parou 3 s): a próxima testemunha não cruza e recomeça a janela
  H.mono.pulo = -3000;
  const errDepois = H.rede.horaServidor() - T.hora;
  banco.definirLatencia(H.cli.cid, 60);
  pr = H.rede.testemunha("bate/h", { sid: "h1" }); await avanca(400); await pr;
  ok(Math.abs(errDepois + 3000) < 20 && Math.abs(H.rede.horaServidor() - T.hora) <= 60.5 && H.rede._hora().amostras === 1, `o relógio monótono pulou 3 s: a testemunha recomeça a janela (erro ${errDepois.toFixed(0)} → ${(H.rede.horaServidor() - T.hora).toFixed(1)} ms)`);
  // o relógio de um aparelho ±5 s: as horas gravadas são as do servidor
  desvio = -5000;
  const H2 = aparelho("SALA3", { latencia: 25, desvio: () => -5000 });
  await avanca(200);
  pr = H2.rede.testemunha("bate/h2", {}); const s2 = T.hora; await avanca(300); const tw2 = await pr;
  ok(tw2 >= s2 && tw2 <= s2 + 100 && Math.abs(H2.rede.horaServidor() - T.hora) <= 25.5, "o aparelho atrasado 5 s: a testemunha e a hora são as do servidor");

  // duas abas da mesma conta gravam o mesmo bate: a leitura de depois do ack é a da outra — sem testemunho, sem calibrar
  const X = aparelho("SALA7", { latencia: 50 }), Y = aparelho("SALA7", { latencia: 10 });
  await avanca(300);
  pr = X.rede.testemunha("bate/eu", { sid: "x" });
  await avanca(50);
  Y.rede.gravar("bate/eu", { sid: "y", ts: 1 });
  await avanca(500); const twX = await pr;
  ok(twX === null && X.rede._hora().amostras === 0 && sala("SALA7").bate.eu.sid === "y", "outra aba gravou o mesmo bate antes da leitura: a testemunha devolve null e não calibra");

  /* F4 o ack perdido: a transação rejeita com 'desconectado' e o servidor gravou; conferir lendo de novo */
  const K = aparelho("SALA4", { latencia: 20 });
  await avanca(200);
  await ja(K.rede.gravar("cont", 1)); await avanca(100);
  banco.cairNoProximoAck(K.cli.cid);
  let erro = null;
  pr = K.rede.transacao("cont", c => (c || 0) + 1).catch(e => { erro = e; });
  await avanca(500); await pr;
  ok(erro && erro.codigo === "desconectado" && sala("SALA4").cont === 2 && !K.rede.conectado(), "o ack perdido: rejeita com 'desconectado' e o servidor gravou (" + (erro && erro.message) + ")");
  banco.conectar(K.cli.cid); await avanca(300);
  ok((await ja(K.rede.ler("cont"))) === 2 && K.rede.conectado(), "na volta, ler de novo resolve o 'Conferindo…'");
  // a gravação com o ack perdido: fica guardada, vai de novo na volta e só então resolve
  banco.cairNoProximoAck(K.cli.cid);
  let gravou = false; const pg = K.rede.gravar("g", { v: 7 }).then(() => { gravou = true; });
  await avanca(300);
  ok(!gravou && sala("SALA4").g && sala("SALA4").g.v === 7, "set com o ack perdido: o servidor tem, a promessa espera");
  banco.conectar(K.cli.cid); await avanca(300); await pg;
  ok(gravou && sala("SALA4").g.v === 7, "na volta, o set vai de novo e resolve");
  // a transação feita sem conexão vai na volta (o SDK guarda a que não foi mandada)
  banco.derrubar(K.cli.cid); await avanca(50);
  let feitoOff = null; pr = K.rede.transacao("cont", c => (c || 0) + 10).then(x => { feitoOff = x; });
  await avanca(500);
  ok(feitoOff === null && sala("SALA4").cont === 2, "sem conexão a transação espera");
  banco.conectar(K.cli.cid); await avanca(500); await pr;
  ok(feitoOff && feitoOff.feito && sala("SALA4").cont === 12, "na volta a transação vai: " + JSON.stringify(feitoOff));

  /* F5 permissão recusada e a limpeza dos valores */
  banco.negar = (op, caminho) => caminho.includes("/proibido");
  let ep = null; await ja(K.rede.gravar("proibido", 1).catch(e => { ep = e; })); await avanca(100);
  let et = null; pr = K.rede.transacao("proibido", () => 1).catch(e => { et = e; }); await avanca(300); await pr;
  ok(ep && ep.codigo === "permissao" && et && et.codigo === "permissao" && sala("SALA4").proibido == null, "sem permissão: gravar e transação rejeitam com 'permissao'");
  banco.negar = null;
  let lancou = null; try { K.cli.db.ref("leiloes/SALA4/z").set({ a: undefined }); } catch (e) { lancou = e.message; }
  await ja(K.rede.gravar("z", { a: undefined, b: NaN, c: [], d: 1, e: { f: undefined } })); await avanca(100);
  ok(/contains undefined/.test(lancou || "") && jsonIgual(sala("SALA4").z, { d: 1 }), "o SDK recusa undefined; a rede limpa como a memória: " + JSON.stringify(sala("SALA4").z));
  await ja(K.rede.atualizar("", { "escal/0": { formacao: "4-4-2" }, "escal/1": { formacao: "4-3-3" } })); await avanca(100);
  const escal = await ja(K.rede.ler("escal"));
  ok(Array.isArray(escal) && escal.length === 2, "o nó de chaves 0..n volta como LISTA (o val() do SDK; a sessão aceita os dois)");

  /* F6 o ouvir sempre depois (o SDK chama dentro do on() e do set) */
  const O = aparelho("SALA5");
  await avanca(100);
  await ja(O.rede.gravar("a", 1)); await avanca(50);
  const pO = O.rede.ouvir("a", () => {}); await avanca(50);   // o caminho fica com o cache pronto
  let dentro = 0, depois = 0, fase = "on";
  const pO2 = O.rede.ouvir("a", () => { if (fase === "on" || fase === "set") dentro++; else depois++; });
  fase = "set"; O.rede.gravar("a", 2); fase = "fora";
  await avanca(100);
  ok(dentro === 0 && depois === 2, `o ouvir nunca chama dentro do on() nem do set (dentro ${dentro}, depois ${depois})`);
  pO(); pO2();

  /* F7 reconectar (goOffline/goOnline: o servidor roda o onDisconnect), aoCair/aoVoltar, apagar, indisponível */
  let caiu = 0, voltou = 0; O.rede.aoCair(() => caiu++); O.rede.aoVoltar(() => voltou++);
  await ja(O.rede.gravar("pres/o", true)); await ja(O.rede.aoDesconectar("pres/o").apagar()); await avanca(50);
  O.rede.reconectar(); await avanca(300);
  ok(caiu === 1 && voltou === 1 && O.rede.conectado() && sala("SALA5").pres == null, "reconectar: cai (o onDisconnect roda no servidor) e volta");
  await ja(O.rede.apagar()); await avanca(100);
  let ea = null; await O.rede.gravar("a", 3).catch(e => { ea = e; });
  ok(sala("SALA5") == null && ea && ea.codigo === "apagada", "apagar: a sala some no servidor e nada mais grava");
  let ei = null; try { R.firebase("X", {}); } catch (e) { ei = e; }
  ok(ei && ei.codigo === "indisponivel", "sem o banco do TM: erro 'indisponivel'");
  O.rede.fechar();

  /* F8 a disputa: 4 aparelhos, 12 incrementos cada, latências diferentes, todos no mesmo instante */
  const D = [0, 15, 40, 90].map((lat, i) => aparelho("SALA6", { latencia: lat, uid: "d" + i }));
  await avanca(300);
  const tentativas = [0, 0, 0, 0];
  const ps = [];
  for (let k = 0; k < 12; k++) D.forEach((d, i) => ps.push(d.rede.transacao("cont", c => { tentativas[i]++; return (c || 0) + 1; }).catch(e => ({ feito: false, erro: e.codigo }))));
  await avanca(20000);
  const rs8 = await Promise.all(ps);
  ok(rs8.every(x => x.feito) && sala("SALA6").cont === 48, "4 aparelhos × 12 incrementos ao mesmo tempo somam 48: " + sala("SALA6").cont);
  notas.push(`disputa: ${tentativas.reduce((a, b) => a + b, 0)} rodadas da fn para 48 gravações`);
  notas.push(`bytes baixados pelo aparelho da bateria ${banco.bytes(A.cli.cid).desce}`);
  } catch (e) { erros.push("exceção: " + (e && e.stack || e)); }

  const ms = performance.now() - t00;
  console.log(`${erros.length ? "REPROVOU" : "ok      "} F    rede no Firebase (banco falso como o SDK): a bateria do R, a transação pelo cache, a hora pela testemunha, o ack perdido, a fila sem conexão, onDisconnect, permissão, limpeza, ouvir depois, disputa${notas.length ? " — " + notas.join("; ") : ""} (${(ms / 1000).toFixed(1)} s)`);
  if (erros.length) { falhas++; erros.slice(0, VERBOSO ? 200 : 12).forEach(e => console.log("         · " + e)); }
}

/* ============================================ O o leilão online (a sessão sobre o Firebase falso) ============================================
   As sessões online (criarSala, entrar, abrir) pela rede firebase() do leilao-rede.js sobre o banco falso que se comporta
   como o SDK compat (ferramentas/lib/banco-falso.mjs), com o tempo de mentira, em 2, 4 e 8 "aparelhos" (cada um com o seu
   cliente, a sua latência e o seu relógio): a sala por transação (pedido, aceitar, recusar, tirar, configurar, Pronto,
   Começar), as recusas (código, sala cheia, recusado, edição, regras, fair play), o leilão inteiro com os mesmos vivo,
   compras e caixas em todos, a corrida de lances, o relógio ±5 s e o pulo depois da calibração (o servidor confere que
   ninguém fecha cedo e nenhum lance entra depois do fim), quem cai, quem some, o ack perdido, o lance velho na
   repescagem, recarregar, a sala adulterada, passar o clube, outra aba, a presença, a limpeza e as Minhas salas; O7 a sala
   mexida fora das regras (o vivo apagado, os lotes trocados no saguão, a edição trocada antes do Começar, o bate a caminho
   depois de encerrar) e O8 a volta da página escondida sem derrubar a conexão do TM inteiro (as salas dos outros modos).
   Nenhum Firebase de verdade. --rapido: só os leilões de 2 e 4 aparelhos inteiros (o de 8 corta na metade). */
async function testeOnline() {
  if (SO && !SO.includes("O")) return;
  const t00 = performance.now(), erros = [], notas = [];
  const DEPURA = !!process.env.LEILAO_DEPURA;
  const ok = (c, m) => { if (!c) { erros.push(m); if (DEPURA) process.stderr.write("  ✗ " + m + "\n"); } return !!c; };
  const marca = s => { if (DEPURA) process.stderr.write(`[${((performance.now() - t00) / 1000).toFixed(1)} s · ${(T.hora / 1000).toFixed(0)} · ${eventos}] ${s}\n`); };
  const TMx = TMs.public, SS = TMx.leilaoSessao, Lx = TMx.leilao, R = TMx.leilaoRede;
  const { BancoFalso } = await import(pathToFileURL(path.join(RAIZ, "ferramentas/lib/banco-falso.mjs")).href);
  const RAPIDO = args.includes("--rapido");
  // --caso O1,O4,quatro: só esses pedaços (para depurar)
  const CASOS = opt("--caso", null) ? opt("--caso").split(",") : null, caso = n => !CASOS || CASOS.includes(n);
  // o tempo de mentira: o servidor, os agendadores das sessões e os relógios dos aparelhos andam juntos
  const T = { hora: 5_000_000, fila: [], seq: 0 };
  const agendar = (fn, ms) => { const e = { at: T.hora + Math.max(0, +ms || 0), fn, s: T.seq++, morto: false }; T.fila.push(e); return e; };
  const cancelar = e => { if (e) e.morto = true; };
  const respira = async () => { for (let i = 0; i < 3; i++) await new Promise(r => setImmediate(r)); };
  let eventos = 0;
  // anda o tempo de acontecimento em acontecimento até pare() (ou até limiteMs de tempo de mentira); um laço que roda
  // 20 mil acontecimentos sem o tempo andar é defeito (a sessão tentando a mesma coisa na hora): reprova em vez de travar
  async function anda(pare, limiteMs = 2 * 3600_000) {
    const fim = T.hora + limiteMs;
    let parado = 0, horaAntes = T.hora;
    for (let k = 0; k < 4_000_000; k++) {
      if (T.hora !== horaAntes) { horaAntes = T.hora; parado = 0; } else if (++parado > 20000) throw new Error("laço sem o tempo andar em " + T.hora);
      await respira();
      if (pare && pare()) return true;
      if (T.fila.length > 4000) T.fila = T.fila.filter(e => !e.morto);
      let m = -1;
      for (let i = 0; i < T.fila.length; i++) { const e = T.fila[i]; if (e.morto) continue; if (m < 0 || e.at < T.fila[m].at || (e.at === T.fila[m].at && e.s < T.fila[m].s)) m = i; }
      if (m < 0 || T.fila[m].at > fim) {
        for (let i = 0; i < 4; i++) await respira();
        if (pare && pare()) return true;
        if (T.fila.some(e => !e.morto && e.at <= fim)) continue;
        T.hora = Math.max(T.hora, fim === Infinity ? T.hora : fim);
        return !!(pare && pare());
      }
      const e = T.fila.splice(m, 1)[0];
      T.hora = Math.max(T.hora, e.at); eventos++;
      try { e.fn(); } catch (er) { erros.push("exceção num acontecimento: " + (er && er.stack || er)); }
    }
    return false;
  }
  const passa = ms => anda(null, ms);
  async function espera(p, limiteMs = 120_000) {
    let feito = false, val, err;
    p.then(v => { feito = true; val = v; }, e => { feito = true; err = e; });
    await anda(() => feito, limiteMs);
    if (!feito) throw new Error("a promessa não resolveu em " + limiteMs + " ms");
    if (err) throw err;
    return val;
  }
  async function rejeita(p, limiteMs) { try { await espera(p, limiteMs); return null; } catch (e) { return e && e.codigo ? e.codigo : String(e && e.message || e); } }
  const banco = new BancoFalso({ relogio: () => T.hora, tempo: () => T.hora, agendar });

  // ---------- o servidor confere cada gravação do vivo: ninguém fecha cedo, nenhum lance depois do fim ----------
  const conf = {};   // código → { ctx, cedo: [], tarde: [], fechados, lances }
  const escreveOrig = banco._escreve.bind(banco);
  banco._escreve = itens => {
    const vivos = [];
    for (const [ps] of itens) if (ps.length === 3 && ps[0] === "leiloes" && ps[2] === "vivo" && conf[ps[1]]) vivos.push(ps[1]);
    const antes = vivos.map(c => banco.ler("leiloes/" + c + "/vivo"));
    escreveOrig(itens);
    vivos.forEach((c, j) => {
      const C = conf[c], A = antes[j], B = banco.ler("leiloes/" + c + "/vivo");
      if (!C.ctx || !A || !B) return;
      const a = Lx.norm(A, C.ctx), b = Lx.norm(B, C.ctx), fimA = Lx.fimDoLote(a, C.ctx);
      if (a.fase === "fim" || a.i < 0) return;
      if (b.seq === a.seq && b.n > a.n) { C.lances++; if (T.hora >= fimA) C.tarde.push({ seq: a.seq, n: b.n, hora: T.hora, fim: fimA }); }
      if (b.seq > a.seq) {
        C.fechados++; C.fechouEm[a.seq] = { hora: T.hora, fim: fimA };
        if (T.hora < fimA && !Lx.todosPassaram(a, C.ctx)) {
          // antes do fim só fecha o passe que deixa todos passados
          let porPasse = false;
          for (let t = 0; t < C.ctx.T && !porPasse; t++) {
            if (t === a.lider || a.p.charAt(t) === "1") continue;
            const a2 = Object.assign({}, a, { p: a.p.slice(0, t) + "1" + a.p.slice(t + 1) });
            if (Lx.todosPassaram(a2, C.ctx) && b.p !== a2.p) porPasse = true;
          }
          if (!porPasse) C.cedo.push({ seq: a.seq, hora: T.hora, fim: fimA, falta: fimA - T.hora });
        }
      }
    });
  };
  function vigia(codigo) {
    conf[codigo] = conf[codigo] || { ctx: null, cedo: [], tarde: [], fechados: 0, lances: 0, fechouEm: {} };
    const C = conf[codigo], lt = banco.ler("leiloes/" + codigo + "/lotes"), s = banco.ler("leiloes/" + codigo + "/sala");
    if (lt && s && s.ordem) C.ctx = Lx.contexto({ T: s.ordem.length, lotes: lt.l, fora: lt.f || [], semente: s.meta.semente, tempo: s.cfg.tempo });
    return C;
  }

  // ---------- os aparelhos ----------
  let nAp = 0;
  const DOCS = [];
  function documento() { const d = { hidden: false, ouvintes: [], addEventListener(n, f) { if (n === "visibilitychange") this.ouvintes.push(f); }, removeEventListener(n, f) { this.ouvintes = this.ouvintes.filter(x => x !== f); }, esconde(sim) { this.hidden = sim; this.ouvintes.slice().forEach(f => f()); } }; DOCS.push(d); return d; }
  // um aparelho: o cliente do banco falso (o SDK), a identidade (uid do TM e o da autenticação), a edição, o armazém das
  // Minhas salas e a página (a visibilidade); desvio = o relógio de parede dele; mono.pulo = o relógio monótono pulando
  function aparelho(uid, o = {}) {
    nAp++;
    const dev = { uid, ed: o.ed || "public", liberado: !!o.liberado, suspenso: false, desvio: o.desvio || 0, arm: armazemFalso(), doc: documento(), sessoes: [] };
    dev.cli = banco.cliente({ uid: "auth-" + uid, latencia: o.latencia ?? 20, relogio: () => T.hora + dev.desvio });
    dev.mono = { base: 40_000 + nAp * 977, pulo: 0 };
    dev.redePara = codigo => R.firebase(codigo, { db: dev.cli.db, firebase: dev.cli.firebase, relogio: () => T.hora - 5_000_000 + dev.mono.base + dev.mono.pulo, relogioParede: () => T.hora + dev.desvio });
    dev.opc = extra => Object.assign({
      id: { uid, auth: "auth-" + uid, nome: o.nome || ("Pessoa " + uid.toUpperCase()), num: "1000-" + String(nAp).padStart(4, "0") },
      redePara: dev.redePara, edicao: () => dev.ed, suUnlocked: () => dev.liberado, trocarEdicao: ed => { dev.ed = ed; dev.trocou = ed; return ed; },
      fairplay: () => dev.suspenso, armazem: dev.arm, agendar, cancelar, mundo: MUNDO[dev.ed === "pro" ? "pro" : "public"], doc: dev.doc, semAtual: true
    }, extra || {});
    dev.criar = (c, extra) => espera(SS.criarSala(Object.assign(dev.opc(extra), c))).then(S => { dev.sessoes.push(S); return S; });
    dev.entrar = (codigo, extra) => espera(SS.entrar(codigo, dev.opc(extra))).then(S => { dev.sessoes.push(S); return S; });
    dev.abrir = (codigo, extra) => espera(SS.abrir(codigo, dev.opc(Object.assign({ online: true }, extra)))).then(S => { dev.sessoes.push(S); return S; });
    dev.cair = (volta) => banco.derrubar(dev.cli.cid, volta != null ? { volta } : {});
    dev.voltar = () => banco.conectar(dev.cli.cid);
    dev.bytes = () => banco.bytes(dev.cli.cid);
    return dev;
  }
  const mesmo = (Ss) => { const j = Ss.map(S => JSON.stringify(S.vivo)); return j.every(x => x === j[0]); };
  function sala(c) { return banco.ler("leiloes/" + c + "/sala"); }
  function fimOk(S, id) {
    const v = S.vivoN, ctx = S.ctx;
    if (!ok(v && v.fase === "fim", `${id}: não chegou ao fim`)) return;
    for (let t = 0; t < ctx.T; t++) {
      const time = Lx.timeDe(v, ctx, t);
      ok(time.length === 11 && Lx.formacoesQueCabem(Lx.contaMascaras(time)).length > 0, `${id}: técnico ${t} com ${time.length} que não cabem`);
    }
    ok(!S.alterada, `${id}: a conferência acusou a sala honesta (${S.alterada})`);
  }
  // as vendas registradas batem com o vivo (o dono de cada lote e o caixa = 100 − a soma dos preços)
  function vendasOk(codigo, ctx, id) {
    const v = Lx.norm(banco.ler("leiloes/" + codigo + "/vivo"), ctx), vd = banco.ler("leiloes/" + codigo + "/vendas") || {}, soma = new Array(ctx.T).fill(0);
    let erradas = 0, n = 0;
    Object.keys(vd).forEach(k => { const x = vd[k]; if (!x) return; n++; if (Lx.LETRAS.indexOf(v.d.charAt(+k)) !== x.t) erradas++; soma[x.t] += x.v; });
    const vendidos = v.d.split("").filter(c => c !== "-").length;
    ok(!erradas && n === vendidos, `${id}: vendas registradas ${n} × ${vendidos} vendidos (${erradas} com outro dono)`);
    for (let t = 0; t < ctx.T; t++) ok(Lx.SALDO - v.cx[t][0] === soma[t], `${id}: o caixa do técnico ${t} (${v.cx[t][0]}) ≠ 100 − as vendas (${soma[t]})`);
  }
  function confOk(C, id) {
    ok(!C.cedo.length, `${id}: ${C.cedo.length} lotes fechados ANTES do fim pela hora do servidor: ${JSON.stringify(C.cedo.slice(0, 3))}`);
    ok(!C.tarde.length, `${id}: ${C.tarde.length} lances entraram DEPOIS do fim: ${JSON.stringify(C.tarde.slice(0, 3))}`);
  }

  try {

  if (caso("O1")) /* ---------- O1 entrar: pedido, aceitar, recusar, tirar, as recusas, configurar, Pronto e o Começar ---------- */
  {
    const A = aparelho("a"), B = aparelho("b"), C = aparelho("c"), D = aparelho("d"), E = aparelho("e"), G = aparelho("g");
    // o código sem colisão: AAAAAA já existe (a criação é transação de null: tenta outro)
    banco.gravar("leiloes/AAAAAA/sala", { meta: { dono: "x", estado: "saguao" } });
    const SA = await A.criar({ liga: "br", vagas: 4, bots: 1, tempo: 10, formacao: "4-3-3", codigo: "AAAAAA", clube: { nome: "Leões do Norte", sigla: "LDN", cor: "#ef4444", escudo: "redondo|crown" }, semente: "O1" });
    const cod = SA.codigo;
    ok(cod !== "AAAAAA" && /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(cod) && sala("AAAAAA").meta.dono === "x", "o código colidido vira outro (6 letras sem I, O, 0, 1): " + cod);
    let s = sala(cod);
    ok(s && s.meta.estado === "saguao" && s.meta.dono === "a" && s.meta.regras === Lx.REGRAS && s.meta.edicao === "public" && s.cfg.vagas === 4 && s.cfg.bots === 1 && typeof s.meta.criada === "number",
      "a sala nasce no saguão: " + JSON.stringify(s && s.meta));
    ok(s.tec.a.papel === "dono" && s.tec.a.auth === "auth-a" && s.tec.bot1 && s.tec.bot1.papel === "bot" && s.tec.bot1.clube.cor !== "#ef4444", "o dono e o bot: " + JSON.stringify(Object.keys(s.tec)));
    ok(SS.salas({ armazem: A.arm }).some(x => x.codigo === cod && x.online && x.estado === "saguao"), "Minhas salas do dono tem a sala online");
    await passa(200);
    ok(banco.ler(`leiloes/${cod}/pres/a`) && Object.keys(banco.ler(`leiloes/${cod}/pres/a`)).length === 1 && banco.ler(`leiloes/${cod}/bate/a`).sid === SA.sid, "presença por conexão e o 1º bate do dono");
    ok((await rejeita(SS.entrar("ABC12", B.opc()))) === "codigo" && (await rejeita(SS.entrar("ZZZZZZ", B.opc()))) === "naoExiste", "código com 5 letras e código que não existe");
    // o pedido pelo link colado; o dono aceita (a cor repetida vira outra)
    marca("O1 pedido");
    const SB = await B.entrar("https://exemplo/?leilao=" + cod.toLowerCase(), { clube: { nome: "Leões", sigla: "LEO", cor: "#ef4444", escudo: "classico|star" } });
    ok(SB.pedido && SB.pedido.estado === "esperando" && SB.eu === -1 && sala(cod).pedidos.b && sala(cod).pedidos.b.auth === "auth-b", "o pedido de entrada: " + JSON.stringify(SB.pedido));
    await passa(200);
    ok(SA.ver().saguao.pedidos.length === 1 && SA.ver().saguao.pedidos[0].uid === "b", "o dono vê o pedido");
    let r = await espera(SB.aceitar("b")); ok(!r.ok && r.motivo === "naoMembro", "quem só pediu não aceita ninguém: " + JSON.stringify(r));
    const aceitos = []; SB.on("aceito", () => aceitos.push(1));
    r = await espera(SA.aceitar("b")); await passa(300);
    s = sala(cod);
    ok(r.ok && aceitos.length === 1 && SB.eu === 1 && !SB.pedido && s.tec.b.papel === "tecnico" && !s.pedidos, "aceito: " + JSON.stringify(r) + " eu " + SB.eu);
    ok(s.tec.b.clube.cor !== "#ef4444" && s.tec.bot1.clube.cor !== s.tec.b.clube.cor && SS._sala.ordemPrevista(s).join() === "a,b,bot1", "as cores sem repetir e a ordem (o bot depois das pessoas): " + SS._sala.ordemPrevista(s).join());
    ok(SB.ver().tecnicos.length === 3 && SB.ver().tecnicos[1].eu && SB.ver().tecnicos[2].bot, "o técnico novo vê a sala");
    r = await espera(SB.tirar("bot1")); ok(!r.ok && r.motivo === "dono", "quem não é dono não tira ninguém: " + JSON.stringify(r));
    // recusado: não entra de novo
    const SC = await C.entrar(cod);
    const recus = []; SC.on("recusado", () => recus.push(1));
    await passa(200);
    r = await espera(SA.recusar("c")); await passa(300);
    ok(r.ok && recus.length === 1 && SC.parado && sala(cod).recusados.c, "recusado: " + JSON.stringify(r));
    ok((await rejeita(SS.entrar(cod, C.opc()))) === "recusado" && !SS.salas({ armazem: C.arm }).length, "quem foi recusado não pede de novo (e a sala sai das Minhas salas dele)");
    // a sala cheia (4 vagas: a, b, bot1 e d)
    const SD = await D.entrar(cod); await passa(200); r = await espera(SA.aceitar("d")); await passa(300);
    ok(r.ok && SD.eu === 2 && sala(cod).tec.bot1 && SS._sala.ordemPrevista(sala(cod)).join() === "a,b,d,bot1", "o 3º entra: " + SS._sala.ordemPrevista(sala(cod)).join());
    ok((await rejeita(SS.entrar(cod, E.opc()))) === "cheia", "a sala cheia (com o bot contando)");
    // configurar (só o dono) zera os Pronto
    r = await espera(SB.pronto(true)); r = await espera(SD.pronto(true)); await passa(300);
    ok(SA.ver().saguao.prontos === 3 && SA.ver().saguao.total === 3 && SA.ver().saguao.podeComecar, "todos prontos: " + JSON.stringify(SA.ver().saguao));
    r = await espera(SA.configurar({ tempo: 15 })); await passa(300);
    ok(r.ok && sala(cod).cfg.tempo === 15000 && SA.ver().saguao.prontos === 1 && SA.ver().saguao.faltam.length === 2, "configurar zera os Pronto: " + JSON.stringify(SA.ver().saguao));
    r = await espera(SA.configurar({ vagas: 2 })); ok(!r.ok && r.motivo === "vagas", "vagas a menos que os técnicos: " + JSON.stringify(r));
    // tirar
    const tirados = []; SD.on("tirado", () => tirados.push(1));
    r = await espera(SA.tirar("d")); await passa(300);
    ok(r.ok && tirados.length === 1 && SD.parado && !sala(cod).tec.d && sala(cod).recusados.d, "tirar: " + JSON.stringify(r));
    // a cor de outro técnico
    r = await espera(SB.meuClube({ nome: "Leões", sigla: "LEO", cor: sala(cod).tec.a.clube.cor, escudo: "classico|star" })); ok(!r.ok && r.motivo === "cor", "a cor de outro técnico: " + JSON.stringify(r));
    r = await espera(SB.meuClube({ nome: "Tigres", sigla: "TIG", cor: "#a855f7", escudo: "hexagono|flame" })); await passa(300);
    ok(r.ok && sala(cod).tec.b.clube.nome === "Tigres" && sala(cod).tec.bot1.clube.cor !== "#a855f7", "o clube no saguão (o bot muda de cor se precisar)");
    // fair play e a edição
    G.suspenso = true;
    ok((await rejeita(SS.entrar(cod, G.opc()))) === "fairplay" && (await rejeita(SS.criarSala(G.opc({ liga: "br", vagas: 2 })))) === "fairplay", "suspenso pelo fair play não cria nem entra");
    // o Começar: com alguém sem Pronto, recusa; dois Começar ao mesmo tempo = 1
    marca("O1 começar");
    r = await espera(SA.comecar()); ok(!r.ok && r.motivo === "prontos", "o Começar com alguém sem Pronto: " + JSON.stringify(r));
    await espera(SB.pronto(true)); await passa(300);
    const iniciais = []; const paraIni = SA.rede.ouvir("vivo", v => { if (v && v.seq === 1) iniciais.push(v); });
    const [c1, c2] = await espera(Promise.all([SA.comecar(), SA.comecar()]));
    await anda(() => SA.vivoN && SB.vivoN && SA.ctx && SB.ctx, 30_000);
    s = sala(cod);
    ok([c1, c2].filter(x => x.ok).length === 1 && s.meta.estado === "leilao" && s.ordem.join() === "a,b,bot1" && s.cfg.T === 3, "dois Começar ao mesmo tempo = 1: " + JSON.stringify([c1, c2]));
    ok(banco.ler(`leiloes/${cod}/lotes`).l.length === 39 && banco.ler(`leiloes/${cod}/lotes`).T === 3 && SA.ctx.L === 39 && SB.ctx.L === 39, "os lotes para 3 técnicos");
    ok(SA.vivoN.seq === 1 && iniciais.length === 1 && JSON.stringify(SA.vivo) === JSON.stringify(SB.vivo), "um vivo inicial só, o mesmo nos dois aparelhos");
    paraIni();
    ok((await rejeita(SS.entrar(cod, aparelho("f").opc()))) === null && sala(cod).pedidos.f && sala(cod).pedidos.f.depois, "depois do Começar, o pedido fica (para passar o clube)");
    r = await espera(SA.aceitar("f")); ok(!r.ok && r.motivo === "comecou", "e não dá para aceitar: " + JSON.stringify(r));
    [SA, SB].forEach(x => x.parar());
    nota_("O1", `colisão do código, pedido pelo link, aceitar, recusar, cheia, configurar zera os Pronto, tirar, cor, fair play, dois Começar = 1`);
  }

    marca("O2");
  if (caso("O2")) /* ---------- O2 a edição, as regras e a versão ---------- */
  {
    const P = aparelho("p", { ed: "pro", liberado: true }), Q = aparelho("q"), W = aparelho("w", { liberado: true }), U = aparelho("u", { ed: "pro", liberado: true });
    const SP = await P.criar({ liga: "br", vagas: 4, bots: 0, semente: "O2" });
    ok(sala(SP.codigo).meta.edicao === "pro", "a sala da Season Update");
    ok((await rejeita(SS.entrar(SP.codigo, Q.opc()))) === "edicao" && Q.ed === "public", "na pro, sem a chave: não entra");
    const SW = await W.entrar(SP.codigo);
    ok(W.trocou === "pro" && SW.pedido && sala(SP.codigo).pedidos.w.edicao === "pro", "na pro, com a chave: troca de edição sozinho e pede");
    const SX = await aparelho("x").criar({ liga: "es", vagas: 3, bots: 0, semente: "O2b" });
    const SU = await U.entrar(SX.codigo);
    ok(U.trocou === "public" && SU.pedido, "quem está na pro entra na pública trocando sozinho");
    // regras de outra versão: quem não é da sala não entra; quem é, só olha
    await espera(SX.aceitar("u")); await passa(300);
    banco.gravar(`leiloes/${SX.codigo}/sala/meta/regras`, Lx.REGRAS + 1);
    await passa(300);
    ok((await rejeita(SS.entrar(SX.codigo, aparelho("y").opc()))) === "regras", "regras de outra versão: quem não é da sala não entra");
    ok(SU.soOlhar && SX.soOlhar && (await espera(SU.pronto(true))).ok === false, "quem é da sala, com outras regras, só olha");
    banco.gravar(`leiloes/${SX.codigo}/sala/meta/regras`, Lx.REGRAS);
    banco.gravar(`leiloes/${SX.codigo}/sala/meta/versaoTM`, "v-velha");
    SU.parar(); await passa(200);
    const SU2 = await U.abrir(SX.codigo);
    ok(SU2.eu === 1 && !SU2.soOlhar && SU2.ver().versaoDiferente, "outra versão do TM: quem é da sala volta (com o aviso)");
    [SP, SW, SX, SU2].forEach(x => x.parar());
    nota_("O2", "pro sem chave recusa, pro com chave e pública trocam sozinhos, regras de outra versão, versão do TM só avisa");
  }

    marca("O3");
  /* ---------- O3 os leilões inteiros: 2, 4 e 8 aparelhos ---------- */
  // o piloto: cada pessoa decide como um robô com o perfil do seu índice e age pela API da sessão (o lance e o passe)
  function pilotoOnline(S) {
    const perfil = Lx.perfilRobo(S.ctx.semente, S.eu);
    let pend = null, chave = null, parado = false, acoes = 0;
    const olha = () => {
      const v = S.vivoN;
      if (parado || !v || !S.ctx || v.fase === "fim" || !S.sala || S.sala.meta.estado !== "leilao") { cancelar(pend); pend = null; return; }
      const k = v.seq + ":" + v.n + ":" + v.p;
      if (k === chave) return;
      chave = k; cancelar(pend); pend = null;
      const a = Lx.robo(v, S.ctx, perfil);
      if (!a) return;
      pend = agendar(() => { pend = null; acoes++; if (a.acao === "lance") S.lance(a.alvo); else S.passar(); }, a.quando + 3 - S.hora());
    };
    const off = S.aoMudar(olha);
    olha();
    return { parar() { parado = true; off(); cancelar(pend); }, acoes: () => acoes };
  }
  async function leilaoInteiro(id, n, nb, o = {}) {
    const devs = [];
    for (let k = 0; k < n; k++) devs.push(aparelho(id + "p" + k, { latencia: o.lat ? o.lat(k) : 20, desvio: o.desvio ? o.desvio(k) : 0 }));
    const dono = devs[0];
    const S0 = await dono.criar({ liga: o.liga || "en", vagas: n + nb, bots: nb, tempo: 10, semente: "O3-" + id });
    const cod = S0.codigo, Ss = [S0];
    for (let k = 1; k < n; k++) { Ss.push(await devs[k].entrar(cod)); }
    await passa(300);
    for (let k = 1; k < n; k++) await espera(S0.aceitar(devs[k].uid));
    await passa(500);
    for (let k = 1; k < n; k++) await espera(Ss[k].pronto(true));
    await passa(500);
    marca(id + ": começar");
    const rc = await espera(S0.comecar());
    ok(rc.ok, `${id}: o Começar: ${JSON.stringify(rc)}`);
    await anda(() => Ss.every(S => S.ctx && S.vivoN), 60_000);
    const C = vigia(cod);
    // o relógio de um aparelho pula +60 s DEPOIS da calibração (o de parede; o monótono segue)
    if (o.pula != null) await anda(() => Ss[o.pula].rede._hora().escolhida, 30_000), (devs[o.pula].desvio += 60_000);
    const pils = Ss.map(S => pilotoOnline(S));
    // o aparelho que "dormiu": o relógio monótono fica 4 s para trás no meio do leilão (sem testemunha nova, a hora dele
    // atrasaria 4 s: os lances dele e os dos bots que ele roda entrariam depois do fim)
    if (o.dorme != null) {
      await anda(() => Ss[0].vivoN && Ss[0].vivoN.seq >= 12, 3600_000);
      devs[o.dorme].mono.pulo -= 4000;
    }
    // os DOIS relógios de um aparelho adiantam 5 s juntos (sem salto entre eles): a hora dele fica 5 s à frente até a
    // próxima testemunha; só a testemunha antes de fechar impede o fechamento cedo
    if (o.adianta != null) {
      await anda(() => Ss[0].vivoN && Ss[0].vivoN.seq >= 20, 3600_000);
      devs[o.adianta].mono.pulo += 5000; devs[o.adianta].desvio += 5000;
    }
    let caiu = null;
    if (o.cai) {
      // o 1º aparelho (o dono) cai na metade e não volta
      let ult = -1;
      await anda(() => { if (DEPURA && S0.vivoN && S0.vivoN.seq !== ult) { ult = S0.vivoN.seq; marca(id + " antes da queda seq " + ult + " " + Ss.map(S => S.vivoN && S.vivoN.seq + ":" + S.vivoN.n).join(",")); } return S0.vivoN && S0.vivoN.seq >= Math.floor(S0.ctx.fila.length / 2); }, 3 * 3600_000);
      caiu = { cx: S0.vivoN.cx[0].slice(), d: S0.vivoN.d, seq: S0.vivoN.seq };
      pils[0].parar(); dono.cair(); S0.parar();
    }
    const vivos = Ss.filter(S => !S.parado);
    const metade = o.corta ? Math.floor(Ss[0].ctx.fila.length / 2) : null;
    let ultSeq = -1;
    const chegou = await anda(() => {
      if (DEPURA && vivos[0].vivoN && vivos[0].vivoN.seq !== ultSeq && vivos[0].vivoN.seq % 10 === 0) { ultSeq = vivos[0].vivoN.seq; marca(id + " seq " + ultSeq + " " + vivos.map(S => S.vivoN && S.vivoN.seq).join(",")); }
      return vivos.every(S => S.vivoN && (metade ? S.vivoN.seq >= metade : S.vivoN.fase === "fim")) && mesmo(vivos);
    }, 4 * 3600_000);
    ok(chegou, `${id}: não ${metade ? "chegou à metade" : "terminou"} (seq ${vivos.map(S => S.vivoN && S.vivoN.seq).join(",")})`);
    pils.forEach(p => p.parar());
    if (!metade) {
      // (o campeonato anda sozinho: só de pessoas, os jogos são simulados ao abrir cada rodada e a sala pode ir ao fim)
      const noCamp = S => S.sala && (S.sala.meta.estado === "camp" || S.sala.meta.estado === "fim");
      await anda(() => vivos.every(noCamp), 120_000);
      ok(vivos.every(noCamp), `${id}: a sala não passou à escalação e ao campeonato`);
      vivos.forEach(S => fimOk(S, id + "/" + S.eu));
      vendasOk(cod, vivos[0].ctx, id);
      ok(vivos.every(S => JSON.stringify(S.vivo) === JSON.stringify(banco.ler(`leiloes/${cod}/vivo`))), `${id}: algum aparelho viu outro fim`);
    }
    ok(vivos.every(S => !S.alterada), `${id}: a conferência congelou uma sala honesta: ${vivos.map(S => S.alterada).join(",")}`);
    confOk(C, id);
    if (caiu) {
      const v = vivos[0].vivoN;
      ok(v.cx[0][0] === caiu.cx[0] && v.d.split("").filter((x, i) => x === "a" && caiu.d.charAt(i) !== "a").length === 0, `${id}: quem caiu gastou depois de cair (${caiu.cx[0]} → ${v.cx[0][0]})`);
    }
    const acoes = pils.reduce((a, p) => a + p.acoes(), 0);
    ok(acoes > 0, `${id}: as pessoas não agiram`);
    const bytes = devs.map(d => d.bytes().desce);
    Ss.forEach(S => S.parar());
    return { cod, C, acoes, bytes, fila: vivos[0].ctx.fila.length };
  }
  {
    const vazio = { C: { lances: 0, fechados: 0 }, bytes: [], fila: 0 };
    const r2 = caso("dois") ? await leilaoInteiro("dois", 2, 0, { liga: "it", lat: k => [15, 60][k] }) : vazio;
    const r4 = caso("quatro") ? await leilaoInteiro("quatro", 4, 2, { liga: "br", lat: k => [0, 25, 70, 140][k], desvio: k => [0, 5000, -5000, 0][k], pula: 3, dorme: 0, adianta: 2 }) : vazio;
    const r8 = caso("oito") ? await leilaoInteiro("oito", 8, 0, { liga: "de", lat: k => [0, 10, 20, 40, 60, 90, 120, 150][k], desvio: k => (k % 3 - 1) * 5000, corta: RAPIDO }) : vazio;
    const rq = RAPIDO || !caso("queda") ? null : await leilaoInteiro("queda", 4, 1, { liga: "es", lat: k => [30, 10, 50, 80][k], cai: true });
    const kb = b => (b / 1024).toFixed(0);
    nota_("O3", `2 aparelhos (${r2.fila} lotes, ${r2.C.lances} lances), 4 + 2 bots com ±5 s, o pulo de +60 s e o dono que dorme 4 s, um adiantado 5 s nos dois relógios (${r4.C.lances} lances), 8 (${r8.C.lances} lances${RAPIDO ? ", até a metade" : ""})` +
      (rq ? `, o 1º caindo na metade (${rq.C.fechados} lotes)` : "") + `; ninguém fechou cedo, nenhum lance depois do fim; KB baixados por aparelho: ${r2.bytes.map(kb).join("/")} · ${r4.bytes.map(kb).join("/")} · ${r8.bytes.map(kb).join("/")}`);
  }

    marca("O4");
  if (caso("O4")) /* ---------- O4 dois aparelhos na mão: a corrida, o ack perdido, quem some, o lance velho, recarregar, outra aba ---------- */
  {
    // A e B na mão; C entra, fica pronto e esconde a página (ausente o leilão inteiro: passa sozinho em todo lote)
    const A = aparelho("ma", { latencia: 20 }), B = aparelho("mb", { latencia: 20 }), Cc = aparelho("mc", { latencia: 20 });
    const SA = await A.criar({ liga: "en", vagas: 3, bots: 0, tempo: 10, semente: "O4" });
    const cod = SA.codigo;
    let SB = await B.entrar(cod); await passa(200); await espera(SA.aceitar("mb")); await passa(300); await espera(SB.pronto(true)); await passa(300);
    const SCc = await Cc.entrar(cod); await passa(200); await espera(SA.aceitar("mc")); await passa(300); await espera(SCc.pronto(true)); await passa(300);
    Cc.doc.esconde(true);
    await espera(SA.comecar());
    await anda(() => SA.vivoN && SB.vivoN, 30_000);
    const C = vigia(cod);
    const liberou = S => S.vivoN && S.ctx && S.hora() >= S.vivoN.abre + S.ctx.espera + 50 && S.ver().botoes && S.ver().botoes["+1"].pode;
    // a corrida: os dois +1 no mesmo instante
    await anda(() => liberou(SA) && liberou(SB), 30_000);
    marca("O4 corrida");
    const [ra, rb] = await espera(Promise.all([SA.lance("+1"), SB.lance("+1")]));
    const venc = ra.ok ? ra : rb, perd = ra.ok ? rb : ra;
    ok([ra, rb].filter(x => x.ok).length === 1 && venc.valor === 1 && perd.estado === "antes" && perd.valor === 1, "dois lances no mesmo instante: um vence, o outro vê 'antes' (" + JSON.stringify([ra, rb]) + ")");
    // o ack perdido: o servidor grava e a conexão cai antes da resposta → "Conferindo…" e o resultado certo na volta
    const quem = ra.ok ? SB : SA, dev = ra.ok ? B : A;
    await anda(() => quem.ver().botoes && quem.ver().botoes["+1"].pode, 30_000);
    const seqAck = quem.vivoN.seq;
    banco.cairNoProximoAck(dev.cli.cid);
    const pAck = quem.lance("+1");
    await anda(() => quem.ver().conferindo, 5_000);
    const w = quem.ver();
    ok(w.conferindo && w.botoes && w.botoes["+1"].motivo === "conferindo" && (w.rede === "offline" || w.rede === "atualizando"), "o ack perdido: 'Conferindo…' com os botões desligados: " + JSON.stringify({ c: w.conferindo, m: w.botoes && w.botoes["+1"].motivo, rede: w.rede }));
    await passa(400); dev.voltar();
    const rAck = await espera(pAck, 30_000);
    ok(rAck.ok && rAck.conferido && rAck.estado === "aceito" && (quem.vivoN.seq !== seqAck || quem.vivoN.lider === quem.eu) && quem.ver().rede === "ok", "na volta, o resultado certo (o lance tinha entrado): " + JSON.stringify(rAck));
    // o aparelho que acorda: o relógio monótono parou 5 s (dormiu) e a hora estimada ficou 5 s para trás; o lance no
    // mesmo instante, com o lote já vencido para o servidor (quem fecha está lento), não pode sair com a hora velha
    marca("O4 acorda");
    banco.definirLatencia(A.cli.cid, 600);
    ok(await anda(() => liberou(SB) && SA.vivoN.lider !== SB.eu, 120_000), "o teste do aparelho que acorda precisa de um lote em que B pode dar lance");
    const fimS = Lx.fimDoLote(SB.vivoN, SB.ctx), seqS = SB.vivoN.seq;
    agendar(() => {}, fimS + 150 - T.hora);   // um acontecimento na hora certa (o tempo só para em acontecimentos)
    await anda(() => T.hora >= fimS + 150, 30_000);
    if (ok(SB.vivoN.seq === seqS && banco.ler(`leiloes/${cod}/vivo`).seq === seqS, "o lote ainda aberto no servidor depois do fim (o teste precisa)")) {
      B.mono.pulo -= 5_000;
      const rs = await espera(SB.lance("+1"), 60_000);
      ok(!rs.ok && !C.tarde.length, "o aparelho que acordou com a hora velha não dá lance depois do fim: " + JSON.stringify(rs));
    }
    banco.definirLatencia(A.cli.cid, 20);
    await anda(() => SB.ver().rede === "ok" && SA.ver().rede === "ok" && SB.vivoN.seq > seqS, 60_000);
    // o aparelho adiantado: os DOIS relógios de A pulam +10 s juntos (sem salto entre eles) logo que o lote libera e logo
    // depois de um bate; o passe de B faz A refazer as contas com a hora errada; só a testemunha antes de fechar impede o
    // fechamento 10 s antes da hora
    marca("O4 adiantado");
    const achou = await anda(() => SA.vivoN.fase === "lotes" && SA.vivoN.n === 0 && T.hora - SA.vivoN.abre >= SA.ctx.espera && T.hora - SA.vivoN.abre < SA.ctx.espera + 800 && SB.ver().botoes && SB.ver().botoes.passar.pode, 120_000);
    ok(achou, "o teste do adiantado precisa de um lote novo em que B pode passar");
    const seqAd = SA.vivoN.seq, cedoAntes = C.cedo.length;
    A.mono.pulo += 10_000; A.desvio += 10_000;
    SA._limpaBate(); SA._timerBate = agendar(() => { SA._timerBate = null; SA._bater(); }, 5000);   // o próximo bate só daqui a 5 s
    await espera(SB.passar());
    await anda(() => banco.ler(`leiloes/${cod}/vivo`).seq > seqAd, 60_000);
    // ninguém passou por A neste lote: ele só pode fechar na hora (o passe que fecharia não existiu)
    const fAd = C.fechouEm[seqAd];
    ok(C.cedo.length === cedoAntes && fAd && fAd.hora >= fAd.fim, "o aparelho com os dois relógios 10 s adiantados não fecha o lote cedo (a testemunha): " + JSON.stringify(fAd && { falta: fAd.fim - fAd.hora }));
    // quem some (a página escondida: sem bate) passa sozinho e não gasta; volta ao controle quando volta
    const caixaB = () => SA.vivoN.cx[SB.eu][0];
    const pilA = pilotoOnline(SA);
    ok(await anda(() => SA.vivoN.seq >= seqAck + 2, 120_000), "o leilão andou depois do ack perdido");
    const antesB = caixaB(), dAntes = SA.vivoN.d;
    marca("O4 some");
    B.doc.esconde(true);
    await passa(13_000);
    const ausVisto = SA.ver().tecnicos[SB.eu].ausente, seqSome = SA.vivoN.seq;
    // o último estado de cada lote (visto por A) desde que B virou ausente: B passou ou não podia
    const ultimos = {}, offU = SA.aoMudar(() => { if (SA.vivoN && SA.vivoN.fase !== "fim") ultimos[SA.vivoN.seq] = SA.vivoN; });
    await anda(() => SA.vivoN.seq >= seqSome + 5, 300_000);
    offU();
    const vSome = SA.vivoN, lotesSome = Object.keys(ultimos).map(Number).filter(q => q > seqSome && q < vSome.seq).map(q => ultimos[q]);
    ok(ausVisto && caixaB() === antesB && vSome.d.split("").every((x, i) => x !== Lx.letra(SB.eu) || dAntes.charAt(i) === x), `quem some não gasta (R$ ${antesB} → ${caixaB()}) e aparece ausente (${ausVisto})`);
    ok(lotesSome.length >= 3 && lotesSome.every(v => v.p.charAt(SB.eu) === "1" || !Lx.pode(v, SA.ctx, SB.eu).pode), "e passa sozinho em cada lote: " + lotesSome.map(v => v.p).join(" "));
    B.doc.esconde(false);
    await anda(() => SB.ver().rede === "ok" && !SA.ver().tecnicos[SB.eu].ausente, 30_000);
    ok(SB.ver().rede === "ok" && !SA.ver().tecnicos[SB.eu].ausente, "de volta (depois de > 5 s escondida): reconecta e fica em dia");
    await anda(() => liberou(SB) && SA.vivoN.lider !== SB.eu, 120_000);
    const rVolta = await espera(SB.lance(SB.ver().botoes.tudo.alvo));
    ok(rVolta.ok || rVolta.estado === "antes", "de volta ao controle, o lance vale: " + JSON.stringify(rVolta));
    pilA.parar();
    // recarregar no meio: a sessão para e abre de novo (outro sid); o mesmo estado e o mesmo técnico
    const vAntes = JSON.stringify(SB.vivo);
    SB.parar(); await passa(50);
    SB = await B.abrir(cod);
    ok(SB.eu === 1 && SB.ctx && (JSON.stringify(SB.vivo) === vAntes || SB.vivoN.seq >= JSON.parse(vAntes).seq), "recarregar no meio: o mesmo técnico e o leilão de onde estava");
    // a presença: o servidor apaga quando a conexão cai e a sessão rearma na volta
    const presB = () => Object.keys(banco.ler(`leiloes/${cod}/pres/mb`) || {});
    await anda(() => presB().includes(SB.sid), 5_000);
    ok(presB().includes(SB.sid), "a presença de quem está: " + presB());
    B.cair(); await passa(300);
    ok(!presB().length && SB.ver().rede === "offline" && SB.ver().botoes && !SB.ver().botoes["+1"].pode && ["conexao", "lider", "passou", "pausa", "fim", "completo", "goleiro", "posicao", "max", "tarde"].includes(SB.ver().botoes["+1"].motivo), "a conexão caiu: a presença sai (onDisconnect) e os botões desligam");
    B.voltar(); await anda(() => SB.ver().rede === "ok", 30_000);
    ok(presB().includes(SB.sid) && SB.ver().rede === "ok", "na volta, a presença rearmada");
    // bate sem ack em 3 s = "Reconectando…"
    banco.definirLatencia(B.cli.cid, 2500);
    await anda(() => SB.ver().rede === "reconectando", 20_000);
    ok(SB.ver().rede === "reconectando", "o bate sem ack em 3 s: 'Reconectando…'");
    banco.definirLatencia(B.cli.cid, 20);
    await anda(() => SB.ver().rede === "ok", 30_000);
    // o lance velho guardado: o socket meio aberto (a conexão parece de pé, mas o que sobe fica parado 60 s); o lote
    // daquele lance fecha (sem lance, vai para a repescagem e reabre depois com outro seq); quando o lance chega, é recusado
    marca("O4 lance velho");
    ok(await anda(() => liberou(SB) && SB.vivoN.fase === "lotes", 120_000), "o teste do lance velho precisa de um lote (fase lotes) em que B pode dar lance");
    const iVelho = SB.vivoN.i, seqVelho = SB.vivoN.seq;
    banco.definirLatencia(B.cli.cid, { sobe: 60_000, desce: 20 });
    const pVelho = SB.lance("+1");
    await passa(10); banco.definirLatencia(B.cli.cid, 20);
    const rv = await espera(pVelho, 5 * 60_000);
    await anda(() => SB.ver().rede === "ok", 60_000);
    const vVelho = Lx.norm(banco.ler(`leiloes/${cod}/vivo`), SA.ctx);
    ok(!rv.ok && (rv.estado === "fechado" || rv.motivo === "velho") && vVelho.seq > seqVelho && vVelho.d.charAt(iVelho) !== Lx.letra(SB.eu),
      `o lance velho guardado é recusado: ${JSON.stringify(rv)} (o lote ${iVelho} ${vVelho.d.charAt(iVelho) === "-" ? (vVelho.sem.includes(iVelho) ? "foi para a repescagem" : "sem dono") : "ficou com " + vVelho.d.charAt(iVelho)})`);
    // outra aba da mesma conta: a mais nova age; a mais velha fica só olhando (e volta quando a nova some)
    marca("O4 outra aba");
    await anda(() => SB._desde != null, 30_000);
    // as transações e as testemunhas da aba velha enquanto a nova manda (tem de ser nenhuma: nem o motor age)
    const txVelha = { n: 0, ativo: false }, txOrig = SB.rede.transacao, twOrig = SB.rede.testemunha;
    SB.rede.transacao = (c, f) => { if (txVelha.ativo) txVelha.n++; return txOrig(c, f); };
    SB.rede.testemunha = (c, x) => { if (txVelha.ativo) txVelha.n++; return twOrig(c, x); };
    const SB2 = await B.abrir(cod);
    await anda(() => SB.outraAba, 10_000);
    // A escondida: a aba nova de B é a 1ª presente (a que age na hora); a velha não pode agir junto
    txVelha.ativo = true;
    A.doc.esconde(true);
    await passa(25_000);
    A.doc.esconde(false); txVelha.ativo = false;
    await anda(() => SA.ver().rede === "ok", 30_000);
    ok(SB.outraAba && !SB2.outraAba && SB._impede() === "outraAba" && txVelha.n === 0 && banco.ler(`leiloes/${cod}/bate/mb`).sid === SB2.sid,
      `outra aba: só a mais recente age (${SB.outraAba}/${SB2.outraAba}; a velha fez ${txVelha.n} transações/testemunhas)`);
    SB2.parar(); await passa(20_000);
    ok(!SB.outraAba, "a mais nova fechou: a mais velha volta a agir");
    await anda(() => SA.vivoN.fase === "fim" && SB.vivoN && SB.vivoN.fase === "fim", 3 * 3600_000);
    fimOk(SA, "O4"); fimOk(SB, "O4b"); confOk(C, "O4");
    // a sala adulterada (o saldo que sobe, gravado direto no servidor): todos congelam
    const alt = []; SA.on("alterada", x => alt.push(x)); SB.on("alterada", x => alt.push(x));
    const vv = banco.ler(`leiloes/${cod}/vivo`); vv.cx[0][0] += 50; banco.gravar(`leiloes/${cod}/vivo`, vv);
    await passa(500);
    ok(SA.alterada && SB.alterada && alt.length === 2 && SA.ver().alterada, "a sala alterada fora das regras congela em todos: " + SA.alterada + "/" + SB.alterada);
    [SA, SB].forEach(x => x.parar());
    nota_("O4", "a corrida, o ack perdido (Conferindo…), quem some passa e volta, recarregar, outra aba, a presença, Reconectando…, o lance velho na repescagem, a sala adulterada");
  }

    marca("O5");
  if (caso("O5")) /* ---------- O5 passar o clube de quem trocou de aparelho ---------- */
  {
    const A = aparelho("ca"), B = aparelho("cb"), B2 = aparelho("cb-novo");
    const SA = await A.criar({ liga: "fr", vagas: 3, bots: 1, semente: "O5" }), cod = SA.codigo;
    const SB = await B.entrar(cod); await passa(200); await espera(SA.aceitar("cb")); await passa(300); await espera(SB.pronto(true)); await passa(300);
    await espera(SA.comecar()); await anda(() => SA.vivoN && SB.vivoN, 30_000);
    const passados = []; SB.on("passado", () => passados.push(1));
    // a pessoa limpou os dados: outra conta pede para entrar
    const SN = await B2.entrar(cod); await passa(300);
    ok(SN.pedido && SN.pedido.depois && SA.ver().pedidosDepois && SA.ver().pedidosDepois.some(p => p.uid === "cb-novo"), "o pedido de quem trocou de aparelho aparece para o dono");
    let r = await espera(SA.passarClube("cb", "cb-novo")); await passa(500);
    const s = sala(cod);
    ok(r.ok && s.ordem[1] === "cb-novo" && s.tec["cb-novo"] && !s.tec.cb && SN.eu === 1 && !SN.pedido && passados.length === 1 && SB.eu === -1, "passar o clube: " + JSON.stringify(r) + " ordem " + s.ordem);
    await anda(() => SN.ver().botoes && SN.ver().botoes.passar.pode, 60_000);
    r = await espera(SN.passar());
    ok(r.ok, "a conta nova age pelo clube: " + JSON.stringify(r));
    ok((await espera(SB.lance("+1"))).ok === false, "a conta velha não age mais");
    [SA, SB, SN].forEach(x => x.parar());
    nota_("O5", "o pedido depois do Começar, passar o clube, a conta nova age e a velha não");
  }

    marca("O6");
  if (caso("O6")) /* ---------- O6 a limpeza e as Minhas salas ---------- */
  {
    const A = aparelho("la"), B = aparelho("lb");
    // 30 min parada no saguão: a sessão de quem está apaga (pela testemunha)
    const SA = await A.criar({ liga: "en", vagas: 3, bots: 1, semente: "O6" }), cod = SA.codigo;
    const apagadas = []; SA.on("apagada", () => apagadas.push(1));
    await passa(29 * 60000);
    ok(sala(cod), "com 29 min parada no saguão, a sala continua");
    await passa(2 * 60000);
    ok(!sala(cod) && apagadas.length === 1 && SA.parado && !SS.salas({ armazem: A.arm }).length, "30 min parada no saguão: a sala some (e sai das Minhas salas)");
    // 24 h sem atividade: quem abre a sala vencida apaga; a entrada de quem não é da sala recusa
    const SA2 = await A.criar({ liga: "en", vagas: 2, bots: 1, semente: "O6b" }), cod2 = SA2.codigo;
    await espera(SA2.comecar()); await anda(() => SA2.vivoN && SA2.vivoN.seq >= 3, 120_000);
    SA2.parar(); await passa(25 * 3600_000);
    ok(sala(cod2) && (await rejeita(SS.entrar(cod2, B.opc()))) === "vencida", "a sala vencida recusa a entrada");
    const SA3 = await A.abrir(cod2);
    await anda(() => !sala(cod2), 60_000);
    ok(!sala(cod2) && SA3.apagada && !SS.salas({ armazem: A.arm }).length, "24 h sem atividade: quem abre apaga");
    // encerrar: some para todos; as Minhas salas dos outros conferem
    const SA4 = await A.criar({ liga: "it", vagas: 3, bots: 0, semente: "O6c" }), cod4 = SA4.codigo;
    const SB4 = await B.entrar(cod4); await passa(200); await espera(SA4.aceitar("lb")); await passa(300);
    ok(SS.salas({ armazem: B.arm }).some(x => x.codigo === cod4), "a sala nas Minhas salas de quem entrou");
    SB4.parar(); await passa(100);
    await espera(SA4.encerrar()); await passa(300);
    const lista = await espera(SS.conferirSalas(B.opc()));
    ok(!sala(cod4) && !lista.some(x => x.codigo === cod4) && (await rejeita(SS.abrir(cod4, B.opc({ online: true })))) === "naoExiste", "o dono encerra: a sala some e sai das Minhas salas na conferência");
    nota_("O6", "30 min no saguão, 24 h sem atividade, a vencida recusa a entrada, encerrar, conferirSalas");
  }

    marca("O7");
  if (caso("O7")) /* ---------- O7 a sala mexida fora das regras e o rastro: o vivo apagado, os lotes trocados no saguão, a edição trocada antes do Começar, o bate a caminho depois de encerrar ---------- */
  {
    // (a) o vivo apagado no meio do leilão (uma gravação de qualquer conta logada): congela em todos, nada recomeça
    const A = aparelho("va"), B = aparelho("vb");
    const SA = await A.criar({ liga: "en", vagas: 4, bots: 2, tempo: 10, semente: "O7" }), cod = SA.codigo;
    let SB = await B.entrar(cod); await passa(200); await espera(SA.aceitar("vb")); await passa(300); await espera(SB.pronto(true)); await passa(300);
    await espera(SA.comecar()); await anda(() => SA.vivoN && SB.vivoN, 30_000);
    await anda(() => SA.vivoN.seq >= 6, 3600_000);
    const altV = []; [SA, SB].forEach(S => S.on("alterada", x => altV.push(x.motivo)));
    banco.gravar(`leiloes/${cod}/vivo`, null);
    await passa(20_000);
    ok(!banco.ler(`leiloes/${cod}/vivo`) && SA.alterada && SB.alterada && altV.length === 2 && SA.ver().alterada,
      `o vivo apagado no meio: a sala congela em todos e o leilão não recomeça do zero (alterada ${SA.alterada}/${SB.alterada}, vivo ${JSON.stringify(banco.ler(`leiloes/${cod}/vivo`) && banco.ler(`leiloes/${cod}/vivo`).seq)})`);
    // (b) recarregar com o vivo apagado e as vendas gravadas: também congela (não refaz o vivo inicial)
    SB.parar(); await passa(100);
    SB = await B.abrir(cod); await passa(10_000);
    ok(SB.alterada && !banco.ler(`leiloes/${cod}/vivo`), `recarregar com o vivo apagado e vendas gravadas: congela (${SB.alterada})`);
    [SA, SB].forEach(x => x.parar());
    // (c) os lotes trocados no saguão por outra conta (mesmo T e liga, outras notas): o Começar grava os deste aparelho
    const C1 = aparelho("vc"), C2 = aparelho("vd");
    const SC = await C1.criar({ liga: "en", vagas: 3, bots: 1, tempo: 10, semente: "O7c" }), codC = SC.codigo;
    const SD = await C2.entrar(codC); await passa(200); await espera(SC.aceitar("vd")); await passa(300); await espera(SD.pronto(true)); await passa(300);
    const certos = TMs.public.leilao.criarLotes(MUNDO.public, "en", 3), mexidos = { l: JSON.parse(JSON.stringify(certos.lotes)), f: certos.fora, T: 3, liga: "en" };
    mexidos.l.forEach(r => { r.overall = 99; });
    banco.gravar(`leiloes/${codC}/lotes`, mexidos);
    await passa(300);
    const rC = await espera(SC.comecar());
    await anda(() => SC.ctx && SD.ctx && SC.vivoN && SD.vivoN, 30_000);
    const ltC = banco.ler(`leiloes/${codC}/lotes`);
    ok(rC.ok && ltC.l.every((r, i) => r.overall === certos.lotes[i].overall) && ltC.ed === "public" && SC.ctx.lotes.every(r => r.overall !== 99) && SD.ctx.lotes.every(r => r.overall !== 99) && !SC.alterada && !SD.alterada,
      "os lotes trocados no saguão: o Começar grava os do mundo-base (com a edição da sala) e as duas sessões usam esses: " + JSON.stringify(rC));
    // depois do Começar, lotes trocados = a sala congela (como antes)
    banco.gravar(`leiloes/${codC}/lotes`, mexidos); await passa(500);
    ok(SC.alterada === "lotes" && SD.alterada === "lotes", "os lotes trocados depois do Começar: congela");
    [SC, SD].forEach(x => x.parar());
    // (d) a edição do aparelho do dono trocada antes do Começar (a tela de início faz isso sem recarregar): os lotes saem
    // da edição DA SALA, nunca da Season Update numa sala pública
    const E = { ed: "public" }, edOrig = TMs.public.storage.edition;
    const D1 = aparelho("ve"), D2 = aparelho("vf");
    const edHooks = { edicao: () => E.ed, trocarEdicao: ed => { E.ed = ed; return ed; }, suUnlocked: () => true, mundo: null };
    TMs.public.storage.edition = () => E.ed;
    try {
      const SE = await D1.criar({ liga: "br", ligaNome: "Brasil", vagas: 3, bots: 1, tempo: 10, semente: "O7d" }, edHooks), codE = SE.codigo;
      const SF = await D2.entrar(codE); await passa(200); await espera(SE.aceitar("vf")); await passa(300); await espera(SF.pronto(true)); await passa(300);
      E.ed = "pro";
      const rE = await espera(SE.comecar());
      await anda(() => SE.ctx && SF.ctx, 30_000);
      const ltE = banco.ler(`leiloes/${codE}/lotes`), pub = TMs.public.leilao.criarLotes(MUNDO.public, "br", 3);
      ok(rE.ok && E.ed === "public" && ltE && ltE.ed === "public" && ltE.l.every((r, i) => r.id === pub.lotes[i].id) && !SF.alterada,
        `a edição trocada antes do Começar: volta à da sala e os lotes são os da pública (${JSON.stringify(rE)}, edição ${E.ed}, 1º ${ltE && ltE.l[0].name} × ${pub.lotes[0].name})`);
      [SE, SF].forEach(x => x.parar());
    } finally { TMs.public.storage.edition = edOrig; }
    // (e) o bate a caminho quando o dono encerra: nada fica órfão em leiloes/{código}
    const G0 = aparelho("vg", { latencia: 0 }), G1 = aparelho("vh", { latencia: 200 });
    const SG = await G0.criar({ liga: "en", vagas: 3, bots: 1, tempo: 10, semente: "O7e" }), codG = SG.codigo;
    const SH = await G1.entrar(codG); await passa(1500); await espera(SG.aceitar("vh")); await passa(6000);
    await anda(() => SH._bateEmVoo, 60_000); await passa(20);
    const rG = await espera(SG.encerrar()); await passa(5000);
    ok(rG.ok && SH.apagada && banco.ler(`leiloes/${codG}`) == null, "o bate a caminho quando o dono encerra: a sala não volta (sobrou " + JSON.stringify(banco.ler(`leiloes/${codG}`)) + ")");
    [SG, SH].forEach(x => x.parar());
    nota_("O7", "o vivo apagado congela (também ao recarregar), os lotes trocados no saguão são regravados no Começar, a edição trocada volta à da sala, o bate a caminho não recria a sala encerrada");
  }

    marca("O8");
  if (caso("O8")) /* ---------- O8 a volta da página escondida não derruba a conexão do TM inteiro (as salas dos outros modos) ---------- */
  {
    // o goOffline/goOnline vale para o TM todo: o servidor roda o onDisconnect das salas do Online 3D e dos outros modos.
    // Só com o socket preso (o bate sem ack em 3 s depois da volta) e sem outra sala online aberta
    const outra = { v: false };
    const A = aparelho("xa"), B = aparelho("xb");
    const SA = await A.criar({ liga: "en", vagas: 3, bots: 1, tempo: 10, semente: "O8" }), cod = SA.codigo;
    const SB = await B.entrar(cod, { outrasSalas: () => outra.v }); await passa(200); await espera(SA.aceitar("xb")); await passa(300);
    await anda(() => SB.ver().rede === "ok", 30_000);
    // a sala de outro modo deste aparelho: some se a conexão cair (o onDisconnect dela)
    B.cli.db.ref("salas3d/OUTRA").set({ dono: "xb" }); B.cli.db.ref("salas3d/OUTRA").onDisconnect().remove();
    await passa(500);
    let reconexoes = 0; const recOrig = SB.rede.reconectar; SB.rede.reconectar = () => { reconexoes++; recOrig(); };
    // (a) escondida 7 s com o socket bom: volta "Atualizando…", fica em dia sem reconectar e a outra sala continua
    B.doc.esconde(true); await passa(7000); B.doc.esconde(false);
    const atualizando = SB.ver().rede === "atualizando";
    await anda(() => SB.ver().rede === "ok", 30_000);
    ok(atualizando && SB.ver().rede === "ok" && reconexoes === 0 && banco.ler("salas3d/OUTRA"),
      `a volta depois de 7 s escondida com o socket bom: "Atualizando…", em dia sem derrubar a conexão (${reconexoes} reconexões; a sala do outro modo ${banco.ler("salas3d/OUTRA") ? "continua" : "SUMIU"})`);
    // (b) o socket preso na volta (o que sobe fica parado): sem outra sala aberta, reconecta UMA vez depois de 3 s sem ack
    outra.v = true;
    B.doc.esconde(true); await passa(7000);
    banco.definirLatencia(B.cli.cid, { sobe: 60_000, desce: 20 });
    B.doc.esconde(false); await passa(4000);
    ok(reconexoes === 0 && SB.ver().rede === "reconectando" && banco.ler("salas3d/OUTRA"), `o socket preso com outra sala online aberta: "Reconectando…" sem derrubar a conexão (${reconexoes} reconexões, ${SB.ver().rede})`);
    banco.definirLatencia(B.cli.cid, 20); await anda(() => SB.ver().rede === "ok", 120_000);
    outra.v = false;
    B.doc.esconde(true); await passa(7000);
    banco.definirLatencia(B.cli.cid, { sobe: 60_000, desce: 20 });
    B.doc.esconde(false); await passa(4000);
    banco.definirLatencia(B.cli.cid, 20);
    await anda(() => SB.ver().rede === "ok", 120_000);
    ok(reconexoes === 1 && SB.ver().rede === "ok", `o socket preso sem outra sala: reconecta uma vez e fica em dia (${reconexoes} reconexões, ${SB.ver().rede})`);
    [SA, SB].forEach(x => x.parar());
    banco.gravar("salas3d/OUTRA", null);
    nota_("O8", "a volta com o socket bom não reconecta (a sala de outro modo continua); com o socket preso, só sem outra sala online aberta");
  }
  } catch (e) { erros.push("exceção: " + (e && e.stack || e)); }
  function nota_(b, s) { notas.push(b + ": " + s); }

  DOCS.length = 0;
  const ms = performance.now() - t00;
  console.log(`${erros.length ? "REPROVOU" : "ok      "} O    leilão online (a sessão sobre o Firebase falso): a sala por transação, as recusas, 2/4/8 aparelhos, o relógio, quem cai e quem some, o ack perdido, o lance velho, recarregar, outra aba, passar o clube, a limpeza (${(ms / 1000).toFixed(1)} s, ${eventos} acontecimentos)`);
  if (VERBOSO || erros.length) notas.forEach(n => console.log("         " + n));
  if (erros.length) { falhas++; erros.slice(0, VERBOSO ? 200 : 14).forEach(e => console.log("         · " + e)); if (erros.length > 14 && !VERBOSO) console.log(`         · … mais ${erros.length - 14}`); }
}

/* ===================================================== C o campeonato (PR 3) ===================================================== */
// o motor (js/engine.js) num contexto à parte: o rng.js daqui + o código dado (o da main, pelo git, ou o de agora)
function motorEm(src) {
  const ctx = { console, Math, Date, JSON };
  ctx.window = ctx;
  vm.createContext(ctx);
  ctx.TM = {};
  vm.runInContext(fs.readFileSync(path.join(RAIZ, "js/rng.js"), "utf8"), ctx, { filename: "rng.js" });
  vm.runInContext(src, ctx, { filename: "engine.js" });
  return ctx.TM;
}
// os casos do C7 (o motor SEM a opção): times sintéticos pelo rng do TM (sem o data.js: a referência não muda quando o mundo
// muda) × as opções que o TM usa (realismo, mando, clássico, prorrogação, tática, dificuldade, jogador em foco, fase) ×
// elencos de 11 e de 18 (com banco: as substituições); cada caso = a partida inteira e uma disputa de pênaltis
// (uma função declarada: o --gravar-motor roda no topo do arquivo, antes das constantes daqui)
function VARIANTES_MOTOR() {
  return [{}, { realism: 1 }, { realism: 5, neutral: true }, { derby: true, crowd: 1 },
    { startMinute: 91, endMinute: 120, startScore: [1, 1] }, { tacticSide: 0, tactic: "pressao", userSide: 0, difficulty: "lenda" },
    { focusPlayerId: "j3_9" }, { tactics: ["retranca", "ofensivo"], form: [1, -1], stakes: [1, 0] }];
}
function casosMotor(TMx) {
  const R = TMx.rng, POS = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "FW", "FW", "GK", "DF", "MF", "MF", "FW", "FW", "DF"];
  function time(s, n) {
    const r = R.make(R.hashStr("motor-time:" + s));
    return { id: "t" + s, name: "Time " + s, players: POS.slice(0, n).map((p, i) => {
      const a = () => 40 + Math.floor(r() * 55);
      return { id: "j" + s + "_" + i, name: "Jogador " + s + "-" + i, pos: p, overall: a(), attrs: { pac: a(), sho: a(), pas: a(), dri: a(), def: a(), phy: a() } };
    }) };
  }
  const out = [], vars = VARIANTES_MOTOR();
  for (let vi = 0; vi < vars.length; vi++) for (const n of [11, 18]) for (let s = 0; s < 60; s++) {
    const sem = "motor:" + s + ":" + vi + ":" + n;
    const r = R.comSemente(sem, () => TMx.engine.simulate(time(s, n), time(s + 1000, n), Object.assign({}, vars[vi])));
    const p = R.comSemente(sem + ":pen", () => TMx.engine.shootout(time(s, n), time(s + 1000, n)));
    out.push({ grupo: vi + "|" + n, txt: JSON.stringify(r) + "|" + JSON.stringify(p) });
  }
  return out;
}
function sha(txt) { return crypto.createHash("sha256").update(txt).digest("hex"); }
function resumoMotor(casos) {
  const por = {};
  casos.forEach(c => { (por[c.grupo] = por[c.grupo] || []).push(c.txt); });
  const porGrupo = {};
  Object.keys(por).forEach(g => { porGrupo[g] = sha(por[g].join("\n")).slice(0, 16); });
  return { casos: casos.length, sha256: sha(casos.map(c => c.txt).join("\n")), porGrupo };
}
function engineDaMain() {
  try { return execSync("git show origin/main:legacy-total-match/js/engine.js", { cwd: RAIZ, stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch (e) { return null; }
}
// --gravar-motor [arquivo]: a referência do C7 (o motor de antes; padrão: o da origin/main)
function gravarMotor() {
  const i = args.indexOf("--gravar-motor"), arq = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
  let src = null, de = null;
  if (arq) { src = fs.readFileSync(arq, "utf8"); de = path.relative(RAIZ, path.resolve(arq)); }
  else {
    src = engineDaMain();
    if (!src) { console.log("sem a origin/main no git (git fetch origin main) e sem arquivo: nada gravado"); return 1; }
    de = "origin/main " + execSync("git rev-parse --short origin/main", { cwd: RAIZ }).toString().trim();
  }
  const ref = Object.assign({ sobre: "O motor (js/engine.js) SEM a opção semLesao: " + VARIANTES_MOTOR().length * 2 * 60 + " partidas e disputas de pênaltis de times sintéticos (testar-leilao.mjs, bloco C7; o sha256 do JSON de cada resultado). Regravar só com mudança DE PROPÓSITO no motor: node ferramentas/testar-leilao.mjs --gravar-motor", de }, resumoMotor(casosMotor(motorEm(src))));
  fs.mkdirSync(path.dirname(REF_MOTOR), { recursive: true });
  fs.writeFileSync(REF_MOTOR, JSON.stringify(ref, null, 2) + "\n");
  console.log("referência do motor gravada: " + path.relative(RAIZ, REF_MOTOR) + " (" + ref.casos + " casos, de " + de + ")");
  return 0;
}

async function testeCamp() {
  await blocoAsync("C", "campeonato: calendário, tabela, chave, gol de ouro, semente, misto, semLesao e o motor, a máquina do jogo", async (ok, nota) => {
    const TMx = TMs.public, LC = TMx.leilaoCamp, Lx = TMx.leilao, Rd = TMx.leilaoRede;
    const seqN = n => [...Array(n).keys()];
    const ESPERADAS = { mata: [1, 2, 2, 3, 3, 3, 3], pontos: [2, 6, 6, 10, 10, 14, 14], misto: [2, 4, 4, 7, 7, 9, 9] };
    const CORES = ["#EF4444", "#3B82F6", "#22C55E", "#EAB308", "#A855F7", "#F97316", "#14B8A6", "#EC4899"];
    // o fim de um leilão só de robôs para cada T (os times de verdade do C4, C5, C7 e C8)
    const fins = {};
    function fimLeilao(T) {
      if (!fins[T]) { const ctx = ctxDe("public", "br", T, "camp-" + T), r = leilaoRobos(ctx); fins[T] = { ctx, v: r.v }; }
      return fins[T];
    }
    function campDe(formato, T, semente, extra) {
      const f = fimLeilao(T);
      return LC.contexto(Object.assign({
        codigo: "CAMP" + T, semente, formato, T, ctx: f.ctx, vivo: f.v, inicio: 1000,
        clubes: CORES.slice(0, T).map((cor, t) => ({ nome: "Clube Fictício " + t, sigla: "CF" + t, cor, escudo: "classico|star" })),
        nomes: seqN(T).map(t => "Técnico " + t), tipos: seqN(T).map(() => "bot")
      }, extra || {}));
    }
    // um nó feito sintético (o placar dado; no mata-mata empatado, os pênaltis para `pen`)
    const ESC0 = { formacao: "4-4-2", tit: Array(11).fill(-1) };
    function noFeito(g, pa, pb, pen) {
      const res = { score: [pa, pb], placar: [pa, pb], events: [{ minute: 0, type: "kickoff", text: "x" }] };
      if (pen != null) {
        res.pror = { score: [pa, pb], events: [{ minute: 120, type: "full", score: [pa, pb], text: "Fim da prorrogação!" }] };
        res.pen = { score: pen === 0 ? [4, 2] : [2, 4], winner: pen, kicks: [] };
      }
      res.v = LC.vencedorDe(res);
      return { e: "feito", ab: [g.a, g.b], modo: "simulado", por: -1, motivo: "abertura", trava: 1, ts: 1000 + g.rodada, esc: [ESC0, ESC0], res };
    }
    // o campeonato inteiro com os placares de fn(a, b, g) → [pa, pb, pen?]; confere a cada rodada que nada depois dela abriu
    function campSint(c, fn, id) {
      const jogos = {};
      for (let k = 0; k < 40; k++) {
        const V = LC.montar(c, jogos);
        if (V.fim) return { jogos, V };
        V.rodadas.forEach((R, i) => { if (i > V.atual) ok(!R.aberta && R.jogos.every(g => g.e === "espera"), `${id}: a rodada ${R.n} abriu antes da ${V.atual + 1} acabar`); });
        V.rodadas[V.atual].jogos.forEach(g => {
          if (g.e === "feito") return;
          const p = fn(g.a, g.b, g);
          jogos[g.id] = noFeito(g, p[0], p[1], g.mata && p[0] === p[1] ? (p[2] != null ? p[2] : (g.a < g.b ? 0 : 1)) : null);
        });
      }
      ok(false, `${id}: não acabou`);
      return { jogos, V: LC.montar(c, jogos) };
    }
    function embaralhaChaves(o, sem) {
      const r = rngT(sem), ks = Object.keys(o);
      for (let i = ks.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ks[i], ks[j]] = [ks[j], ks[i]]; }
      const n = {}; ks.forEach(k => { n[k] = o[k]; });
      return n;
    }

    /* ---- C1 o calendário ---- */
    let nCal = 0;
    for (const formato of LC.FORMATOS) for (let T = 2; T <= 8; T++) for (const sem of ["c1a", "c1b", "c1c", "c1d", "c1e"]) {
      const c = LC.contexto({ codigo: "CAL", semente: sem, formato, T }), rod = LC.estrutura(c), id = `C1 ${formato} T${T} ${sem}`;
      nCal++;
      ok(rod.length === ESPERADAS[formato][T - 2] && LC.rodadasDe(formato, T) === rod.length, `${id}: ${rod.length} rodadas (esperava ${ESPERADAS[formato][T - 2]}; rodadasDe ${LC.rodadasDe(formato, T)})`);
      const ids = new Set();
      rod.forEach(r => r.jogos.forEach(g => { ok(!ids.has(g.id) && /^[rm]\d+j\d+$/.test(g.id), `${id}: id ${g.id} repetido ou fora do padrão`); ids.add(g.id); }));
      if (formato !== "mata") {
        const voltas = formato === "pontos" ? 2 : 1, vezes = {}, casa = Array(T).fill(0), fora = Array(T).fill(0), folgas = Array(T).fill(0);
        const liga = rod.filter(r => r.fase === "liga");
        ok(liga.length === (T % 2 ? T : T - 1) * voltas, `${id}: ${liga.length} rodadas de pontos`);
        liga.forEach(r => {
          const vistos = new Set();
          r.jogos.forEach(g => {
            const a = g.src[0].t, b = g.src[1].t, k = Math.min(a, b) + "-" + Math.max(a, b);
            ok(a !== b, `${id}: o técnico ${a} contra ele mesmo na rodada ${r.n}`);
            ok(!vistos.has(a) && !vistos.has(b), `${id}: alguém joga duas vezes na rodada ${r.n}`);
            vistos.add(a); vistos.add(b); (vezes[k] = vezes[k] || []).push([a, b]); casa[a]++; fora[b]++;
          });
          r.folgas.forEach(f => { ok(!vistos.has(f.t), `${id}: quem folga também joga na rodada ${r.n}`); vistos.add(f.t); folgas[f.t]++; });
          ok(vistos.size === T && r.folgas.length === T % 2, `${id}: rodada ${r.n} com ${vistos.size} de ${T} técnicos e ${r.folgas.length} folga(s)`);
        });
        for (let a = 0; a < T; a++) for (let b = a + 1; b < T; b++) {
          const v = vezes[a + "-" + b] || [];
          ok(v.length === voltas, `${id}: ${a} × ${b} ${v.length} vez(es) (esperava ${voltas})`);
          if (voltas === 2 && v.length === 2) ok(v[0][0] === v[1][1] && v[0][1] === v[1][0], `${id}: ${a} × ${b} sem o mando trocado no returno`);
        }
        // o mando alterna: dentro de cada turno ninguém faz 3 jogos seguidos como mandante (ou como visitante); a folga não conta
        for (let v = 1; v <= voltas; v++) for (let t = 0; t < T; t++) {
          const seqM = liga.filter(r => r.turno === v).map(r => { const g = r.jogos.find(x => x.src[0].t === t || x.src[1].t === t); return g ? (g.src[0].t === t ? "C" : "F") : ""; }).join("");
          ok(!/CCC|FFF/.test(seqM), `${id}: o técnico ${t} no ${v}º turno com o mando ${seqM}`);
        }
        for (let t = 0; t < T; t++) {
          ok(folgas[t] === (T % 2 ? voltas : 0), `${id}: o técnico ${t} folgou ${folgas[t]} vez(es)`);
          ok(voltas === 2 ? casa[t] === fora[t] : Math.abs(casa[t] - fora[t]) <= 1, `${id}: o técnico ${t} com ${casa[t]} jogos como mandante e ${fora[t]} como visitante`);
        }
      }
      if (formato === "mata") {
        let P = 1; while (P < T) P *= 2;
        const r1 = rod[0], vistos = [];
        r1.jogos.forEach(g => vistos.push(g.src[0].t, g.src[1].t));
        r1.folgas.forEach(f => vistos.push(f.t));
        ok(vistos.slice().sort((x, y) => x - y).join() === seqN(T).join(), `${id}: a 1ª rodada tem ${vistos.join()}`);
        ok(r1.folgas.length === P - T, `${id}: ${r1.folgas.length} folgas (esperava ${P - T})`);
        const total = rod.reduce((s, r) => s + r.jogos.length, 0);
        ok(total === T - 1, `${id}: ${total} jogos no mata-mata (esperava ${T - 1})`);
        if (rod[1]) {
          const dupla = rod[1].jogos.filter(g => g.src[0].t != null && g.src[1].t != null).length;
          ok(dupla === Math.max(0, P - T - P / 4), `${id}: ${dupla} jogo(s) da 2ª rodada entre dois que folgaram (as folgas não se espalharam)`);
        }
        ok(rod[rod.length - 1].nome === "Final" && rod[rod.length - 1].jogos.length === 1, `${id}: a última rodada não é a final`);
      }
      if (formato === "misto") {
        const mata = rod.filter(r => r.fase === "mata"), srcs = mata[0].jogos.map(g => g.src.map(s => s.pos).join("×")).join(",");
        ok(T <= 4 ? mata.length === 1 && srcs === "0×1" : mata.length === 2 && srcs === "0×3,1×2" && mata[1].nome === "Final", `${id}: o mata-mata do misto ${mata.length} rodada(s), ${srcs}`);
      }
    }
    {
      const e = s => JSON.stringify(LC.estrutura(LC.contexto({ semente: s, formato: "pontos", T: 6 })));
      ok(e("x") === e("x"), "C1: a mesma semente deu outro calendário");
      ok(e("x") !== e("y"), "C1: outra semente deu o mesmo calendário");
      const folgou = new Set();
      for (let s = 0; s < 40; s++) LC.estrutura(LC.contexto({ semente: "f" + s, formato: "mata", T: 5 }))[0].folgas.forEach(f => folgou.add(f.t));
      ok(folgou.size === 5, `C1: em 40 sementes só ${folgou.size} de 5 técnicos folgaram no mata-mata (a semente escolhe quem folga)`);
    }
    nota(`C1 ${nCal} calendários`);

    /* ---- C2 a tabela: 3/1/0 e o desempate total, contra a conta feita no teste ---- */
    function sorteioRef(sem, T) {
      const r = TMx.rng.make(TMx.rng.hashStr("leilao:" + sem + ":camp:desempate")), a = seqN(T), s = [];
      for (let i = T - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      a.forEach((t, i) => { s[t] = i; });
      return s;
    }
    const usoRef = { direto: 0, recursivo: 0, sorteio: 0 };
    function ordemRef(T, lista, sorteio) {
      function conta(ts, js) {
        const m = new Map(ts.map(t => [t, { pts: 0, sg: 0, gp: 0 }]));
        for (const [a, b, pa, pb] of js) {
          if (!m.has(a) || !m.has(b)) continue;
          const A = m.get(a), B = m.get(b);
          A.gp += pa; B.gp += pb; A.sg += pa - pb; B.sg += pb - pa;
          if (pa > pb) A.pts += 3; else if (pb > pa) B.pts += 3; else { A.pts++; B.pts++; }
        }
        return m;
      }
      const chave = s => s.pts * 1e6 + (s.sg + 500) * 1e3 + s.gp;
      function rank(ts, nivel) {
        const m = conta(ts, nivel === 0 ? lista : lista.filter(([a, b]) => ts.includes(a) && ts.includes(b))), grupos = new Map();
        ts.forEach(t => { const k = chave(m.get(t)); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(t); });
        if (nivel > 0 && grupos.size > 1) usoRef.direto++;
        const out = [];
        for (const k of [...grupos.keys()].sort((x, y) => y - x)) {
          const g = grupos.get(k);
          if (g.length === 1) out.push(g[0]);
          else if (nivel === 0 || g.length < ts.length) { if (nivel > 0) usoRef.recursivo++; out.push(...rank(g, nivel + 1)); }
          else { usoRef.sorteio++; out.push(...g.slice().sort((x, y) => sorteio[x] - sorteio[y] || x - y)); }
        }
        return out;
      }
      return { ordem: rank(seqN(T), 0), linhas: conta(seqN(T), lista) };
    }
    let nTab = 0, nChaves = 0;
    for (const formato of ["pontos", "misto"]) for (let T = 3; T <= 8; T++) for (let s = 0; s < 50; s++) {
      const sem = `c2-${formato}-${T}-${s}`, c = LC.contexto({ codigo: "TAB", semente: sem, formato, T }), id = `C2 ${formato} T${T} ${sem}`;
      // placares de 0 a 1 em metade dos sorteios: muitos empates na tabela (o desempate inteiro é exercitado)
      const r = rngT(sem), gols = s % 2 ? 2 : 3;
      const { jogos, V } = campSint(c, () => [Math.floor(r() * gols), Math.floor(r() * gols), Math.floor(r() * 2)], id);
      const lista = [];
      V.rodadas.forEach(R => { if (R.fase === "liga") R.jogos.forEach(g => lista.push([g.a, g.b, g.placar[0], g.placar[1]])); });
      const ref = ordemRef(T, lista, sorteioRef(sem, T)), dele = V.tabela.map(l => l.t);
      nTab++;
      ok(dele.join() === ref.ordem.join(), `${id}: a tabela ${dele.join()} (a conta do teste: ${ref.ordem.join()})`);
      V.tabela.forEach((l, i) => {
        const x = ref.linhas.get(l.t);
        ok(l.pos === i + 1 && l.pts === x.pts && l.sg === x.sg && l.gp === x.gp && l.j === (formato === "pontos" ? 2 : 1) * (T - 1) && l.v + l.e + l.d === l.j && l.pts === 3 * l.v + l.e,
          `${id}: a linha do técnico ${l.t} ${JSON.stringify(l)} (a conta: ${JSON.stringify(x)})`);
      });
      // as chaves do objeto em outra ordem (o Firebase devolve na dele): a mesma vista, inteira
      for (let k = 0; k < 3; k++) {
        nChaves++;
        ok(JSON.stringify(LC.montar(LC.contexto({ codigo: "TAB", semente: sem, formato, T }), embaralhaChaves(jogos, sem + ":" + k))) === JSON.stringify(V), `${id}: com as chaves embaralhadas (${k}) a vista mudou`);
      }
    }
    // casos feitos à mão: o confronto direto recursivo (Y, Z e X empatados em tudo; o confronto dos três tira o X; o de Y × Z
    // decide) e o empate total (o sorteio pela semente)
    {
      const P = { "0-1": [1, 0], "2-0": [1, 0], "1-2": [2, 1], "0-3": [2, 1], "1-3": [1, 0], "2-3": [1, 0] };
      const fn = (a, b) => P[a + "-" + b] ? P[a + "-" + b] : [P[b + "-" + a][1], P[b + "-" + a][0]];
      for (let s = 0; s < 8; s++) {
        const c = LC.contexto({ codigo: "MAO", semente: "mao" + s, formato: "misto", T: 4 });
        const { V } = campSint(c, fn, "C2 recursivo");
        ok(V.tabela.map(l => l.t).join() === "1,2,0,3", `C2 recursivo (semente mao${s}): ${V.tabela.map(l => l.t).join()} (esperava 1,2,0,3)`);
      }
      const ordens = new Set();
      for (let s = 0; s < 8; s++) {
        const sem = "zero" + s, c = LC.contexto({ codigo: "ZERO", semente: sem, formato: "pontos", T: 4 }), so = sorteioRef(sem, 4);
        const { V } = campSint(c, () => [0, 0], "C2 zero");
        const esperado = seqN(4).sort((x, y) => so[x] - so[y]).join();
        ok(V.tabela.map(l => l.t).join() === esperado, `C2 empate total (${sem}): ${V.tabela.map(l => l.t).join()} (o sorteio: ${esperado})`);
        ordens.add(esperado);
      }
      ok(ordens.size >= 3, `C2: o sorteio deu só ${ordens.size} ordem(ns) em 8 sementes`);
    }
    ok(usoRef.direto > 20 && usoRef.recursivo > 0 && usoRef.sorteio > 20, `C2: os sorteios aleatórios exercitaram pouco o desempate (confronto direto ${usoRef.direto}, recursivo ${usoRef.recursivo}, sorteio ${usoRef.sorteio})`);
    nota(`C2 ${nTab} tabelas, ${nChaves} com as chaves embaralhadas, o confronto direto decidiu ${usoRef.direto}× (${usoRef.recursivo} recursivo) e o sorteio ${usoRef.sorteio}×`);

    /* ---- C3 a chave do mata-mata (com folgas) e C6 os classificados do misto ---- */
    let nMata = 0;
    for (const formato of ["mata", "misto"]) for (let T = 2; T <= 8; T++) for (let s = 0; s < 20; s++) {
      const sem = `c3-${formato}-${T}-${s}`, c = LC.contexto({ codigo: "KO", semente: sem, formato, T }), id = `${formato === "mata" ? "C3" : "C6"} T${T} ${sem}`;
      const r = rngT(sem), jogos = {};
      let V = null, viuLigaFeita = false;
      for (let k = 0; k < 40; k++) {
        V = LC.montar(c, jogos);
        if (V.fim) break;
        const R = V.rodadas[V.atual];
        if (formato === "misto" && R.fase === "mata" && !viuLigaFeita) {
          viuLigaFeita = true;
          const tab = V.tabela.map(l => l.t), pares = R.jogos.map(g => g.a + "×" + g.b).join(",");
          const esperado = T <= 4 ? `${tab[0]}×${tab[1]}` : `${tab[0]}×${tab[3]},${tab[1]}×${tab[2]}`;
          ok(V.ligaFeita && pares === esperado, `${id}: os classificados ${pares} (a tabela ${tab.join()}: esperava ${esperado})`);
        }
        if (formato === "misto" && R.fase === "liga") V.rodadas.filter(x => x.fase === "mata").forEach(x => x.jogos.forEach(g => ok(g.a == null && g.b == null && !x.aberta, `${id}: o mata-mata com times antes do fim dos pontos`)));
        R.jogos.forEach(g => {
          if (g.e === "feito") return;
          if (R.fase === "mata") {
            // os da 2ª rodada em diante são os vencedores dos jogos de antes (ou quem folgou)
            g.src.forEach((src, lado) => {
              const t = lado ? g.b : g.a;
              if (src.venc) ok(t === V.rodadas.flatMap(x => x.jogos).find(x => x.id === src.venc).venc, `${id}: ${g.id} com ${t} no lugar do vencedor de ${src.venc}`);
            });
          }
          const pa = Math.floor(r() * 3), pb = Math.floor(r() * 3);
          jogos[g.id] = noFeito(g, pa, pb, g.mata && pa === pb ? Math.floor(r() * 2) : null);
        });
      }
      nMata++;
      ok(V && V.fim, `${id}: não acabou`);
      if (!V || !V.fim) continue;
      const mata = V.rodadas.filter(R => R.fase === "mata"), fin = mata[mata.length - 1].jogos[0];
      ok(V.campeao === fin.venc && V.classificacao[0] === fin.venc && V.classificacao[1] === (fin.venc === fin.a ? fin.b : fin.a), `${id}: o campeão ${V.campeao} e o vice ${V.classificacao[1]} (a final ${fin.a} × ${fin.b}, venceu ${fin.venc})`);
      ok(V.classificacao.slice().sort((x, y) => x - y).join() === seqN(T).join(), `${id}: a classificação ${V.classificacao.join()} não tem todos`);
      // quem caiu mais tarde fica na frente de quem caiu antes
      const caiu = {};
      mata.forEach((R, i) => R.jogos.forEach(g => { const perd = g.venc === g.a ? g.b : g.a; caiu[perd] = i; }));
      for (let i = 0; i + 1 < V.classificacao.length; i++) {
        const x = V.classificacao[i], y = V.classificacao[i + 1];
        if (x !== V.campeao && caiu[x] != null && caiu[y] != null) ok(caiu[x] >= caiu[y], `${id}: ${x} (caiu na rodada ${caiu[x] + 1}) atrás de ${y} (caiu na ${caiu[y] + 1})`);
      }
      if (formato === "misto") {
        const fora = V.classificacao.filter(t => caiu[t] == null && t !== V.campeao), pos = {};
        V.tabela.forEach(l => { pos[l.t] = l.pos; });
        for (let i = 0; i + 1 < fora.length; i++) ok(pos[fora[i]] < pos[fora[i + 1]], `${id}: os não classificados fora da ordem da tabela (${fora.join()})`);
      }
    }
    nota(`C3/C6 ${nMata} chaves`);

    /* ---- C4 o gol de ouro (e os pênaltis) ---- */
    {
      const c = campDe("mata", 4, "ouro"), a = LC.timeDoTecnico(c, 0), b = LC.timeDoTecnico(c, 1);
      ok(a.players.length === 11 && a.players[0].pos === "GK" && a.players[0].number === 1 && a.players.every((p, i) => p.number === i + 1) && a.id === "leilao_CAMP4_0" && a.formation && a.escudoUT.escudo === "classico|star" && a.colors.primary === CORES[0],
        `C4: o time do técnico ${JSON.stringify({ n: a.players.length, pos0: a.players[0] && a.players[0].pos, id: a.id, f: a.formation, esc: a.escudoUT, cores: a.colors })}`);
      const esc = LC.escalacaoDoJogo(c, 0), slots = Lx.slotsDe(esc.formacao);
      ok(a.players.every((p, i) => p.id === Lx.retratoDe(c.ctx, esc.tit[i]).id && (p.overall === Lx.retratoDe(c.ctx, esc.tit[i]).overall - Lx.custoVaga(Lx.retratoDe(c.ctx, esc.tit[i]), slots[i]))),
        "C4: os jogadores do time não estão nas vagas da escalação (ou sem o −1/−2 da função)");
      let n = 0, pror = 0, ouro = 0, pen = 0, cortados = 0;
      for (let s = 0; s < 1500; s++) {
        const res = LC.simularJogo(a, b, { semente: "ouro:" + s, mataMata: true }), id = `C4 ouro:${s}`;
        n++;
        ok(LC.resValido(JSON.parse(JSON.stringify(res)), true) && (res.v === 0 || res.v === 1), `${id}: o resultado não vale no mata-mata (v ${res.v})`);
        const empatou = res.score[0] === res.score[1];
        ok(empatou === !!res.pror, `${id}: ${empatou ? "empate sem prorrogação" : "prorrogação sem empate"}`);
        if (!res.pror) { ok(!res.pen, `${id}: pênaltis sem prorrogação`); continue; }
        pror++;
        const evs = res.pror.events, gols = evs.filter(e => e.type === "goal" || e.type === "pengoal"), ult = evs[evs.length - 1];
        ok(evs.every(e => e.minute >= 91 && e.minute <= 120), `${id}: lance da prorrogação fora dos 91'–120'`);
        if (res.pror.ouro != null) {
          ouro++;
          const g = gols[0];
          ok(gols.length === 1 && evs[evs.length - 2] === g && ult.type === "full" && ult.minute === g.minute, `${id}: o gol de ouro não acabou o jogo (${gols.length} gols, depois dele ${evs.length - 1 - evs.indexOf(g)} lances)`);
          ok(res.pror.ouro === g.team && res.v === g.team && !res.pen && res.placar.join() === g.score.join() && res.pror.score.join() === g.score.join() && Math.abs(g.score[0] - g.score[1]) === 1,
            `${id}: o placar do gol de ouro ${JSON.stringify({ placar: res.placar, pror: res.pror.score, gol: g.score, v: res.v })}`);
          // a prorrogação de hoje (sem o corte) seguiria até os 120'
          const et = TMx.rng.comSemente("ouro:" + s + ":pror", () => TMx.engine.simulate(a, b, { realism: 3, neutral: true, semLesao: true, startMinute: 91, endMinute: 120, startScore: res.score.slice(),
            excludeIds: res.events.filter(e => e.type === "red").map(e => e.playerId), yellowIds: res.events.filter(e => e.type === "yellow").map(e => e.playerId) }));
          ok(JSON.stringify(et.events.slice(0, evs.length - 1)) === JSON.stringify(evs.slice(0, -1)), `${id}: a prorrogação cortada não é o começo da prorrogação do motor`);
          if (et.events.length > evs.length) cortados++;
        } else {
          ok(gols.length === 0 && ult.type === "full" && ult.minute === 120 && res.pror.score.join() === res.score.join() && res.pen && res.pen.winner === res.v, `${id}: sem gol de ouro e sem os pênaltis certos`);
          pen++;
          const fora = new Set(res.events.concat(evs).filter(e => e.type === "red").map(e => e.playerId));
          ok(res.pen.kicks.length >= 6 && res.pen.kicks.every(k => !fora.has(k.id) && k.id), `${id}: um expulso bateu pênalti (ou a disputa curta demais)`);
        }
      }
      ok(pror > 200 && ouro > 50 && pen > 50 && cortados > 30, `C4: poucos casos (${pror} prorrogações, ${ouro} gols de ouro, ${pen} pênaltis, ${cortados} cortes)`);
      let semPror = 0;
      for (let s = 0; s < 300; s++) { const res = LC.simularJogo(a, b, { semente: "pts:" + s }); if (!res.pror && !res.pen) semPror++; }
      ok(semPror === 300, `C4: fora do mata-mata ${300 - semPror} jogos com prorrogação ou pênaltis`);
      nota(`C4 ${n} jogos: ${pror} prorrogações, ${ouro} gols de ouro (${cortados} cortados antes do 120'), ${pen} pênaltis`);
    }

    /* ---- C5 a mesma semente = o mesmo resultado (também noutro "aparelho"); outra trava muda ---- */
    {
      const c = campDe("mata", 4, "sem5"), V = LC.montar(c, {}), g = V.rodadas[0].jogos[0];
      const r1 = LC.reservar(null, { ab: [g.a, g.b], esc: [LC.escalacaoDoJogo(c, g.a), LC.escalacaoDoJogo(c, g.b)], modo: "simulado", por: -1, motivo: "abertura", ts: 1731600000123 });
      const j = r1.jogo, base = LC.resultadoDoJogo(c, g.id, j);
      ok(LC.canon(LC.resultadoDoJogo(c, g.id, JSON.parse(JSON.stringify(j)))) === LC.canon(base), "C5: a mesma semente deu outro resultado");
      ok(LC.canon(Rd.resolve(JSON.parse(JSON.stringify(base)), 0)) === LC.canon(base), "C5: o resultado guardado como o Firebase guarda mudou o texto canônico");
      const antes = Math.random;
      LC.simularJogo(LC.timeDoTecnico(c, 0), LC.timeDoTecnico(c, 1), { semente: "x", mataMata: true });
      ok(Math.random === antes, "C5: o Math.random não voltou ao original depois da simulação");
      // outro "aparelho": um TM carregado do zero, os lotes e o vivo pelo JSON (como chegam do banco)
      const TMb = carrega("public"), f = fimLeilao(4), lt = JSON.parse(JSON.stringify({ l: f.ctx.lotes, f: f.ctx.fora, v: f.v }));
      const cB = TMb.leilaoCamp.contexto({ codigo: "CAMP4", semente: "sem5", formato: "mata", T: 4, ctx: TMb.leilao.contexto({ T: 4, lotes: lt.l, fora: lt.f, semente: f.ctx.semente }), vivo: lt.v,
        clubes: JSON.parse(JSON.stringify(c.clubes)), tipos: c.tipos });
      let iguais = 0, difere = 0;
      for (let k = 0; k < 120; k++) {
        const jk = Object.assign({}, j, { trava: j.trava + k }), id = "m1j" + (k % 2);
        const x = LC.canon(LC.resultadoDoJogo(c, id, jk)), y = TMb.leilaoCamp.canon(TMb.leilaoCamp.resultadoDoJogo(cB, id, JSON.parse(JSON.stringify(jk))));
        if (x === y) iguais++;
        if (x !== LC.canon(LC.resultadoDoJogo(c, id, Object.assign({}, jk, { trava: jk.trava + 1000 })))) difere++;
      }
      ok(iguais === 120, `C5: noutro aparelho ${120 - iguais} de 120 resultados diferentes`);
      ok(difere >= 108, `C5: outra trava mudou só ${difere} de 120 resultados`);
      nota(`C5 120 jogos iguais noutro aparelho, ${difere} mudam com outra trava`);
    }

    /* ---- C7 o semLesao e o motor SEM a opção igual ao de antes ---- */
    {
      const c = campDe("pontos", 4, "les"), a = LC.timeDoTecnico(c, 0), b = LC.timeDoTecnico(c, 1);
      let com = 0, sem = 0;
      for (let s = 0; s < 1500; s++) {
        const x = TMx.rng.comSemente("les:" + s, () => TMx.engine.simulate(a, b, { realism: 3, neutral: true }));
        const y = TMx.rng.comSemente("les:" + s, () => TMx.engine.simulate(a, b, { realism: 3, neutral: true, semLesao: true }));
        if (x.injuries.length) com++;
        if (y.injuries.length || y.events.some(e => e.type === "injury")) sem++;
      }
      ok(sem === 0 && com > 100, `C7: com o semLesao ${sem} jogo(s) com lesão (sem a opção: ${com} de 1500)`);
      const agora = casosMotor(TMx), main = engineDaMain();
      if (main) {
        const antes = casosMotor(motorEm(main)), dif = agora.filter((x, i) => x.txt !== antes[i].txt);
        ok(!dif.length, `C7: o motor sem a opção mudou em ${dif.length} de ${agora.length} casos contra a origin/main (grupos ${[...new Set(dif.map(d => d.grupo))].join(", ")})`);
      }
      let ref = null;
      try { ref = JSON.parse(fs.readFileSync(REF_MOTOR, "utf8")); } catch (e) { ok(false, `C7: sem a referência ${path.relative(RAIZ, REF_MOTOR)} (node ferramentas/testar-leilao.mjs --gravar-motor)`); }
      if (ref) {
        const r = resumoMotor(agora), grupos = Object.keys(ref.porGrupo).filter(g => ref.porGrupo[g] !== r.porGrupo[g]);
        ok(r.casos === ref.casos && r.sha256 === ref.sha256, `C7: o motor sem a opção não bate com a referência gravada (${ref.de}): grupos ${grupos.join(", ") || "?"} (mudança de propósito: --gravar-motor e dizer no PR)`);
      }
      nota(`C7 lesões ${com} → ${sem} em 1500 jogos; o motor sem a opção = ${main ? "a origin/main e " : ""}a referência (${agora.length} casos)`);
    }

    /* ---- C8 a máquina do jogo ---- */
    {
      const PZ = LC.PRAZO, ESC = [ESC0, ESC0];
      const reserva = (j, o) => LC.reservar(j, Object.assign({ ab: [0, 1], esc: ESC, modo: "simulado", por: 0, motivo: "pedido", ts: 5000 }, o));
      let r = LC.abrir(null, { ts: 1000 });
      ok(r.ok && r.jogo.e === "aberto" && r.jogo.ini === 1000 && r.jogo.resta === PZ && LC.prazoDe(r.jogo) === 1000 + PZ, `C8 abrir: ${JSON.stringify(r)}`);
      const ab = r.jogo;
      ok(!LC.abrir(ab, { ts: 2000 }).ok, "C8: abriu duas vezes");
      ok(!LC.pausar(ab, {}).ok, "C8: pausou sem a hora");
      const pa = LC.pausar(ab, { quando: 31000 });
      ok(pa.ok && pa.jogo.parado === true && pa.jogo.resta === PZ - 30000 && LC.prazoDe(pa.jogo) === null, `C8 pausar: ${JSON.stringify(pa)}`);
      ok(LC.pausar(ab, { quando: 500 }).jogo.resta === PZ, "C8: a pausa antes da abertura gastou prazo");
      ok(LC.pausar(ab, { quando: 1000 + PZ + 9999 }).jogo.resta === 0, "C8: o prazo ficou negativo");
      ok(!LC.pausar(pa.jogo, { quando: 40000 }).ok && !LC.retomar(ab, { ts: 1 }).ok, "C8: pausou o parado ou retomou o que corre");
      ok(reserva(pa.jogo, { motivo: "prazo", hora: 1e13 }).motivo === "parado", "C8: o prazo parado venceu");
      const rt = LC.retomar(pa.jogo, { ts: 500000 });
      ok(rt.ok && rt.jogo.ini === 500000 && rt.jogo.resta === PZ - 30000 && !rt.jogo.parado && LC.prazoDe(rt.jogo) === 500000 + PZ - 30000, `C8 retomar: ${JSON.stringify(rt)}`);
      const venc = LC.prazoDe(rt.jogo);
      ok(reserva(rt.jogo, { motivo: "prazo", hora: venc - 1 }).motivo === "cedo" && reserva(rt.jogo, { motivo: "prazo" }).motivo === "cedo", "C8: reservou pelo prazo antes de vencer (ou sem a testemunha)");
      ok(reserva(null, { motivo: "prazo", hora: 1e13 }).motivo === "sem", "C8: venceu o prazo que nunca correu");
      const rp = reserva(rt.jogo, { motivo: "prazo", hora: venc, por: -1 });
      ok(rp.ok && rp.jogo.e === "reservado" && rp.jogo.trava === 5000 && rp.jogo.motivo === "prazo" && rp.jogo.ini == null && rp.jogo.resta == null, `C8 reservar pelo prazo: ${JSON.stringify(rp)}`);
      ok(reserva(null, { ab: [1, 1] }).motivo === "times" && reserva(null, { modo: "2d" }).motivo === "opcao" && reserva(null, { esc: [ESC0] }).motivo === "times", "C8: reservou com os times, o modo ou as escalações errados");
      // a escalação gravada é uma cópia: mexer na de agora depois de reservar não muda o jogo
      const minha = { formacao: "4-3-3", tit: seqN(11) }, rv = reserva(null, { esc: [minha, ESC0] });
      minha.tit[0] = 99;
      ok(rv.ok && rv.jogo.esc[0].tit[0] === 0 && rv.jogo.esc[0].formacao === "4-3-3", "C8: a escalação gravada mudou junto com a de agora");
      ok(reserva(rv.jogo, {}).motivo === "reservado", "C8: reservou duas vezes");
      // gravar: a trava vista, a forma do resultado, uma vez só
      const resOk = { score: [2, 1], placar: [2, 1], events: [{ minute: 0, type: "kickoff", text: "x" }], v: 0 };
      ok(LC.gravar(rv.jogo, { trava: 4999, res: resOk, ts: 6000 }).motivo === "trava", "C8: gravou com outra trava");
      ok(LC.gravar(rv.jogo, { trava: 5000, res: Object.assign({}, resOk, { v: 1 }), ts: 6000 }).motivo === "res", "C8: gravou um resultado com o vencedor errado");
      ok(LC.gravar(rv.jogo, { trava: 5000, res: Object.assign({}, resOk, { placar: [1, 1], score: [1, 1], v: -1 }), ts: 6000, mata: true }).motivo === "res", "C8: gravou empate no mata-mata");
      const gv = LC.gravar(rv.jogo, { trava: 5000, res: resOk, ts: 6000 });
      ok(gv.ok && gv.jogo.e === "feito" && gv.jogo.ts === 6000 && gv.jogo.trava === 5000 && gv.jogo.esc[0].formacao === "4-3-3" && gv.jogo.res.v === 0, `C8 gravar: ${JSON.stringify(gv)}`);
      ok(LC.gravar(gv.jogo, { trava: 5000, res: resOk, ts: 7000 }).motivo === "feito" && reserva(gv.jogo, {}).motivo === "feito", "C8: o feito foi regravado ou reservado de novo");
      // o 3D (PR 4): o prazo pela duração; vencido sem resultado = W.O. de quem reservou
      const c3 = LC.contexto({ formato: "mata", T: 2, semente: "wo" }), r3 = reserva(null, { modo: "3d", por: 1, ts: 10000 });
      ok(r3.ok && r3.jogo.inicio === 10000 && LC.prazoDe(r3.jogo, c3) === 10000 + LC.prazo3d(4) && LC.prazo3d(4) === 1104000, `C8: o prazo do 3D ${LC.prazoDe(r3.jogo, c3)} (18,4 min com 4 min por tempo)`);
      ok(LC.wo(r3.jogo, { trava: 10000, hora: 10000 + 1104000 - 1, ts: 1 }, c3).motivo === "cedo" && LC.wo(rv.jogo, { trava: 5000, hora: 1e13, ts: 1 }, c3).motivo === "trava", "C8: W.O. antes do prazo ou no simulado");
      const w = LC.wo(r3.jogo, { trava: 10000, hora: 10000 + 1104000, ts: 99 }, c3);
      ok(w.ok && w.jogo.e === "feito" && w.jogo.res.wo === 1 && w.jogo.res.placar.join() === "3,0" && w.jogo.res.v === 0 && LC.resValido(w.jogo.res, true), `C8 W.O.: ${JSON.stringify(w)}`);
      // o que fazer agora
      const cP = LC.contexto({ formato: "mata", T: 4, semente: "pa", tipos: ["pessoa", "bot", "pessoa", "bot"] });
      const g = (a, b, j, extra) => Object.assign({ id: "m1j0", a, b, j, e: j ? j.e : "livre", aberta: true, mata: true }, extra);
      const aqui = { presente: () => true, visto: () => 7777 }, longe = { presente: () => false, visto: () => 7777 };
      const A = (gg, info) => JSON.stringify(LC.proximaAcao(cP, gg, info));
      ok(A(g(1, 3, null), longe) === '{"acao":"reservar","motivo":"abertura","quando":0}' && A(g(0, 2, null), longe) === '{"acao":"reservar","motivo":"abertura","quando":0}', "C8: bot × bot ou pessoa × pessoa sem reservar na abertura");
      ok(A(g(0, 1, null), aqui) === '{"acao":"abrir","quando":0}' && A(g(0, 1, null), longe) === "null", "C8: o prazo abre sem ninguém do jogo ou não abre com alguém");
      ok(A(g(0, 1, ab), aqui) === `{"acao":"reservar","motivo":"prazo","quando":${1000 + PZ}}` && A(g(0, 1, ab), longe) === '{"acao":"pausar","quando":0,"desde":7777}', "C8: o prazo correndo não vence ou não para sem ninguém");
      ok(A(g(0, 1, pa.jogo), aqui) === '{"acao":"retomar","quando":0}' && A(g(0, 1, pa.jogo), longe) === "null", "C8: o prazo parado não volta (ou volta sem ninguém)");
      ok(A(g(0, 1, rv.jogo), longe) === '{"acao":"gravar","quando":0}' && A(g(0, 1, r3.jogo), longe) === '{"acao":"wo","quando":1114000}', "C8: o reservado não grava (ou o 3D sem o W.O. no prazo)");
      ok(A(g(0, 1, gv.jogo, { e: "feito" }), aqui) === "null" && A(g(0, 1, null, { aberta: false, e: "espera" }), aqui) === "null", "C8: agiu num jogo feito ou de uma rodada que não abriu");
    }

    /* ---- C8 o campeonato inteiro por 3 "aparelhos" ao mesmo tempo na rede em memória (a mesma interface do online) ---- */
    for (const [formato, T] of [["misto", 5], ["mata", 6], ["pontos", 3]]) {
      const id = `C8 rede ${formato} T${T}`, V0 = relogioVirtual(5_000_000), r = rngT(id);
      const c = campDe(formato, T, "rede-" + formato, { codigo: "REDE" + T, inicio: 5_000_000, tipos: seqN(T).map(t => (t === 0 || (formato === "pontos" && t === 2)) ? "pessoa" : "bot") });
      const lat = () => Math.floor(r() * 150);
      const R0 = Rd.memoria("REDE" + T, { guardar: false, relogio: V0.relogio, agendar: V0.agendar, latencia: lat });
      const redes = [R0, R0.outroCliente({ latencia: lat }), R0.outroCliente({ latencia: lat })];
      const feitos = {}, conta = { tentou: 0, abortou: 0, reservou: {}, gravou: {}, tipo: {} };
      // o feito nunca muda depois de gravado (o ts do 1º feito visto = o do fim)
      R0.ouvir("jogos", js => { Object.keys(js || {}).forEach(k => { if (js[k] && js[k].e === "feito" && feitos[k] == null) feitos[k] = js[k].ts; }); });
      // a pessoa some 50 s a cada 150 s (o prazo para e volta)
      const presente = h => Math.floor((h - 5_000_000) / 50000) % 3 !== 1, visto = h => presente(h) ? h : 5_000_000 + Math.floor((h - 5_000_000) / 50000) * 50000;
      async function age(rede, g, a) {
        const cam = "jogos/" + g.id;
        conta.tentou++;
        let fn = null, hora = null;
        if (a.acao === "abrir") fn = cur => LC.abrir(cur, { ts: rede.TS });
        else if (a.acao === "retomar") fn = cur => LC.retomar(cur, { ts: rede.TS });
        else if (a.acao === "pausar") { hora = await rede.testemunha("bate/x"); fn = cur => LC.pausar(cur, { quando: a.desde != null ? a.desde : hora }); }
        else if (a.acao === "reservar") {
          if (a.motivo === "prazo") hora = await rede.testemunha("bate/x");
          const esc = [LC.escalacaoDoJogo(c, g.a), LC.escalacaoDoJogo(c, g.b)];
          fn = cur => LC.reservar(cur, { ab: [g.a, g.b], esc, modo: "simulado", por: -1, motivo: a.motivo, ts: rede.TS, hora });
        } else if (a.acao === "gravar") {
          const j = g.j, res = LC.resultadoDoJogo(c, g.id, j);
          fn = cur => LC.gravar(cur, { trava: j.trava, res, ts: rede.TS, mata: g.mata });
        }
        if (!fn) return;
        const x = await rede.transacao(cam, cur => { const q = fn(cur); return q.ok ? q.jogo : undefined; });
        if (x.feito) conta.tipo[a.acao] = (conta.tipo[a.acao] || 0) + 1;
        if (!x.feito) conta.abortou++;
        else if (a.acao === "reservar") conta.reservou[g.id] = (conta.reservou[g.id] || 0) + 1;
        else if (a.acao === "gravar") conta.gravou[g.id] = (conta.gravou[g.id] || 0) + 1;
      }
      let fim = false;
      async function aparelho(rede, k) {
        for (let volta = 0; volta < 3000 && !fim; volta++) {
          const V = LC.montar(c, (await rede.ler("jogos")) || {});
          if (V.fim) { fim = true; return; }
          const h = rede.horaServidor(), info = { presente: () => presente(h), visto: () => visto(h), hora: h };
          const acoes = [];
          V.rodadas[V.atual].jogos.forEach(g => { const a = LC.proximaAcao(c, g, info); if (a && a.quando <= h) acoes.push(age(rede, g, a)); });
          await Promise.all(acoes);
          await new Promise(ok2 => V0.agendar(ok2, 800 + k * 700 + Math.floor(r() * 400)));
        }
      }
      await V0.espera(Promise.all(redes.map((rede, k) => aparelho(rede, k))));
      const arv = R0._arvore(), jogos = arv.jogos || {}, V = LC.montar(c, jogos);
      ok(V.fim, `${id}: o campeonato não acabou`);
      const todos = V.rodadas.flatMap(R => R.jogos);
      ok(todos.length === Object.keys(jogos).length && todos.every(g => g.e === "feito"), `${id}: ${todos.filter(g => g.e === "feito").length} de ${todos.length} jogos feitos (${Object.keys(jogos).length} nós)`);
      todos.forEach(g => {
        ok(conta.reservou[g.id] === 1 && conta.gravou[g.id] === 1 && feitos[g.id] === jogos[g.id].ts, `${id}: ${g.id} reservado ${conta.reservou[g.id] || 0}× e gravado ${conta.gravou[g.id] || 0}× (o feito mudou depois: ${feitos[g.id] !== jogos[g.id].ts})`);
        const m = LC.conferirJogo(c, g, jogos[g.id]);
        ok(m === null, `${id}: a conferência acusou ${g.id} (${m})`);
        const pessoaBot = LC.confronto(c, g) === "pessoaBot", j = jogos[g.id];
        ok(j.motivo === (pessoaBot ? "prazo" : "abertura"), `${id}: ${g.id} reservado por '${j.motivo}'`);
        if (pessoaBot) {
          const R = V.rodadas.find(x => x.jogos.includes(g));
          ok(j.trava - R.abre >= LC.PRAZO, `${id}: ${g.id} simulado ${(j.trava - R.abre) / 1000} s depois de a rodada abrir (o prazo é de ${LC.PRAZO / 1000} s com a pessoa presente)`);
        }
      });
      // a mesma vista em todo aparelho
      const vistas = await V0.espera(Promise.all(redes.map(rede => rede.ler("jogos"))));
      ok(vistas.every(js => JSON.stringify(LC.montar(c, js)) === JSON.stringify(V)), `${id}: os aparelhos viram campeonatos diferentes`);
      ok(conta.abortou > 0, `${id}: nenhuma transação disputada (os 3 aparelhos não agiram juntos)`);
      ok(conta.tipo.abrir > 0 && conta.tipo.pausar > 0 && conta.tipo.retomar > 0, `${id}: o prazo não foi exercitado (${JSON.stringify(conta.tipo)})`);
      // a sala adulterada: o placar trocado, a escalação com um jogador de outro, os times trocados, um jogo fora da vez
      const g0 = todos[0], j0 = jogos[g0.id], outro = todos.find(g => g.a !== g0.a && g.b !== g0.a);
      const mexe = f => { const j = JSON.parse(JSON.stringify(j0)); f(j); return LC.conferirJogo(c, g0, j); };
      const g1 = todos.find(g => !jogos[g.id].res.pror);
      if (g1) {
        const j1 = JSON.parse(JSON.stringify(jogos[g1.id])), p = j1.res.placar;
        j1.res.placar = [p[0] + 1, p[1]]; j1.res.score = j1.res.placar.slice(); j1.res.v = LC.vencedorDe(j1.res);
        ok(LC.resValido(j1.res, g1.mata) && LC.conferirJogo(c, g1, j1) === "resultado", `${id}: o placar mexido (${p.join("×")} → ${j1.res.placar.join("×")}) passou`);
      }
      ok(mexe(j => { j.res.events[0].text = "outro"; }) === "resultado", `${id}: o texto de um lance mexido passou`);
      const deOutro = Lx.timeIdx(c.vivo, c.ctx, outro ? outro.a : (g0.a + 1) % T)[0];
      ok(mexe(j => { j.esc[0].tit[5] = deOutro; }) === "escalacao", `${id}: a escalação com um jogador de outro técnico passou`);
      ok(mexe(j => { j.ab = [j.ab[1], j.ab[0]]; }) === "times", `${id}: os times trocados passaram`);
      const futuro = { id: "x", a: g0.a, b: g0.b, aberta: false, mata: g0.mata };
      ok(LC.conferirJogo(c, futuro, j0) === "vez" && LC.conferirJogo(c, g0, Object.assign({}, j0, { e: "nada" })) === "forma", `${id}: o jogo fora da vez ou sem forma passou`);
      nota(`${id.slice(3)}: ${todos.length} jogos, ${conta.tentou} ações (${conta.abortou} disputadas; ${Object.keys(conta.tipo).map(k => k + " " + conta.tipo[k]).join(", ")})`);
    }
  });
}

/* ===================================================== K o campeonato pela sessão (PR 3) =====================================================
   O campeonato da sala pela sessão (leilao-sessao.js) e pela rede: K0 a duração estimada e o formato na sala; K1 o treino
   com 1 pessoa e 1–7 bots nos 3 formatos até o campeão (cada jogo reservado e gravado uma vez, conferido, o prazo de 2 min
   no jogo da pessoa, o "Simular partida" que grava antes de responder, a vista igual noutro "aparelho"); K2 recarregar no
   meio = os mesmos resultados; K3 a escalação mudada vale só a partir do próximo jogo que não começou e a sala adulterada
   congela. O online (2, 4 e 8 aparelhos no banco falso) é o bloco KO. */
// a pessoa do treino de teste: simula o próprio jogo (quando a regra `simula(rodada)` diz) assim que ele abre
function pilotoCamp(S, V, simula) {
  const feitos = new Set(), pedidos = [];
  let parado = false;
  const olha = () => {
    if (parado) return;
    const c = S.ver().camp, mj = c && c.meuJogo;
    if (!mj || !mj.podeSimular || feitos.has(mj.id) || !simula(mj)) return;
    feitos.add(mj.id);
    V.agendar(() => { S.simular(mj.id).then(r => pedidos.push({ id: mj.id, r })); }, 1);
  };
  const off = S.aoMudar(olha);
  olha();
  return { parar() { parado = true; off(); }, pedidos };
}
async function testeCampSessao() {
  await blocoAsync("K", "campeonato pela sessão: o formato, o treino nos 3 formatos até o campeão, o prazo, Simular, recarregar, a escalação do próximo jogo", async (ok, nota) => {
    const TMx = TMs.public, SS = TMx.leilaoSessao, Lx = TMx.leilao, LC = TMx.leilaoCamp, Rd = TMx.leilaoRede, mundo = MUNDO.public;
    /* ---- K0 a duração estimada e o formato ---- */
    {
      const d = LC.duracaoEstimada({ T: 4, tempo: 10000, formato: "mata" }), d8 = LC.duracaoEstimada({ T: 8, tempo: 10000, formato: "pontos", tresD: true, duracao3d: 4 });
      ok(d.leilao.n === 52 && d.leilao.lo === 8 && d.leilao.hi === 15 && d.camp.rodadas === 2 && d.camp.jogos === 3 && d.camp.lo === 1 && d.camp.hi === 4 && d.total.lo === d.leilao.lo + d.camp.lo, "K0 duração com 4 (mata): " + JSON.stringify(d));
      ok(d8.leilao.n === 104 && d8.camp.rodadas === 14 && d8.camp.jogos === 56 && d8.camp.hi > 180 && d8.camp.lo >= 150, "K0 duração com 8 em pontos corridos e 3D (passa de 3 h): " + JSON.stringify(d8));
      for (let T = 2; T <= 8; T++) for (const f of LC.FORMATOS) {
        const e = LC.duracaoEstimada({ T, tempo: 15000, formato: f });
        ok(e.camp.rodadas === LC.rodadasDe(f, T) && e.camp.lo >= 1 && e.camp.hi > e.camp.lo && e.leilao.hi > e.leilao.lo, `K0 ${f} T${T}: ${JSON.stringify(e)}`);
        const c = LC.contexto({ formato: f, T, semente: "k0" });
        ok(LC.jogosDe(f, T) === LC.estrutura(c).reduce((s, R) => s + R.jogos.length, 0), `K0 jogosDe(${f}, ${T}) ≠ o calendário`);
      }
      ok(LC.formatoDe("mataMata") === "mata" && LC.formatoDe("mata-mata") === "mata" && LC.formatoDe("pontosCorridos") === "pontos" && LC.formatoDe("misto") === "misto" && LC.formatoDe("x") === "mata" && LC.formatoDe(null) === "mata", "K0 formatoDe");
    }
    /* ---- K1 o treino com 1 pessoa e 1–7 bots nos 3 formatos, até o campeão ---- */
    const PLANO = [[1, "mata"], [2, "pontos"], [3, "misto"], [4, "mata"], [5, "pontos"], [6, "misto"], [7, "mata"], [1, "pontos"], [2, "misto"], [3, "mata"], [4, "pontos"], [5, "misto"], [6, "mata"], [7, "pontos"], [7, "misto"]];
    let nJogos = 0, nPedido = 0, nPrazo = 0;
    for (const [bots, formato] of PLANO) {
      const T = bots + 1, id = `K1 ${formato} T${T}`, V = relogioVirtual(), arm = armazemFalso(), cod = ("K1" + formato.slice(0, 2) + T).toUpperCase();
      const base = { relogio: V.relogio, agendar: V.agendar, cancelar: V.cancelar, armazem: arm, semAtual: true, mundo };
      const A = await V.espera(SS.criarTreino(Object.assign({ liga: ["br", "en", "it", "es", "de"][T % 5], bots, semente: id, codigo: cod, formato, tempo: 10 }, base)));
      ok(A.sala.cfg.formato === formato && A.ver().formato === formato, `${id}: o formato na sala: ${A.sala.cfg.formato}`);
      const eventos = { jogo: 0, rodada: [] };
      A.on("jogo", () => eventos.jogo++); A.on("rodada", x => eventos.rodada.push(x.n));
      // feitos: o ts do 1º feito visto de cada jogo (o feito nunca muda depois)
      const feitos = {}, reservas = {};
      A.rede.outroCliente().ouvir("jogos", js => Object.keys(js || {}).forEach(k => {
        const j = js[k]; if (!j) return;
        if (j.e !== "aberto" && reservas[k] == null) reservas[k] = j.trava;
        if (j.e === "feito" && feitos[k] == null) feitos[k] = j.ts;
      }));
      await V.anda(() => A.sala && A.sala.meta.estado === "escalacao");
      await V.espera(A.prontoEscalacao(true));
      // a pessoa simula o próprio jogo nas rodadas ímpares; nas pares, deixa o prazo vencer
      const pil = pilotoCamp(A, V, mj => mj.rodada % 2 === 1);
      const chegou = await V.anda(() => A.sala && A.sala.meta.estado === "fim");
      pil.parar();
      ok(chegou, `${id}: o campeonato não acabou (${A.sala && A.sala.meta.estado})`);
      const w = A.ver(), c = w.camp, js = A.jogos;
      if (!ok(c && c.fim, `${id}: sem a vista do fim`)) { A.parar(); continue; }
      const todos = c.rodadas.flatMap(R => R.jogos);
      ok(todos.length === LC.jogosDe(formato, T) && c.rodadas.length === LC.rodadasDe(formato, T), `${id}: ${todos.length} jogos em ${c.rodadas.length} rodadas`);
      ok(todos.every(g => g.e === "feito") && Object.keys(js).length === todos.length, `${id}: jogos sem resultado`);
      ok(c.campeao != null && c.classificacao.length === T && new Set(c.classificacao).size === T && c.classificacao[0] === c.campeao, `${id}: o campeão e a classificação: ${c.campeao} ${c.classificacao}`);
      ok(!A.alterada, `${id}: a conferência congelou o treino honesto (${A.alterada} ${JSON.stringify(A.alteradaJogo)})`);
      ok(typeof A.sala.meta.camp === "number" && typeof A.sala.meta.fimCamp === "number" && A.sala.meta.fimCamp >= A.sala.meta.camp, `${id}: meta.camp/fimCamp`);
      ok(eventos.jogo === todos.length && eventos.rodada.length === c.rodadas.length, `${id}: eventos ${eventos.jogo} jogos, ${eventos.rodada.length} rodadas`);
      if (formato !== "mata") ok(c.tabela && c.tabela.length === T, `${id}: a tabela`);
      ok(c.melhorTime && c.notas && c.notas.length === T && c.notas[0].soma === c.melhorTime.soma, `${id}: o melhor time`);
      const ctxC = A._campCtx();
      todos.forEach(g => {
        const j = js[g.id];
        nJogos++;
        ok(feitos[g.id] === j.ts && reservas[g.id] === j.trava, `${id}: ${g.id} mudou depois de gravado (ou reservado duas vezes)`);
        ok(LC.conferirJogo(ctxC, g, j) === null, `${id}: ${g.id} não confere`);
        // a escalação gravada = a do técnico no momento (a automática, aqui)
        const pessoaBot = LC.confronto(ctxC, g) === "pessoaBot", R = c.rodadas.find(x => x.jogos.includes(g));
        if (pessoaBot) {
          const minhaRodadaImpar = R.n % 2 === 1;
          if (minhaRodadaImpar) { nPedido++; ok(j.motivo === "pedido" && j.por === 0 && j.trava - R.abre < LC.PRAZO, `${id}: ${g.id} (Simular) reservado por '${j.motivo}' ${(j.trava - R.abre) / 1000} s depois`); }
          else { nPrazo++; ok(j.motivo === "prazo" && j.trava - R.abre >= LC.PRAZO && j.trava - R.abre < LC.PRAZO + 5000, `${id}: ${g.id} (prazo) reservado por '${j.motivo}' ${(j.trava - R.abre) / 1000} s depois (o prazo é de ${LC.PRAZO / 1000} s)`); }
        } else ok(j.motivo === "abertura" && j.trava - R.abre < 5000, `${id}: ${g.id} (${LC.confronto(ctxC, g)}) reservado por '${j.motivo}'`);
      });
      // o "Simular partida" respondeu com o resultado GRAVADO
      pil.pedidos.forEach(p => ok(p.r.ok && p.r.jogo && p.r.jogo.e === "feito" && JSON.stringify(p.r.res) === JSON.stringify(js[p.id].res), `${id}: o Simular de ${p.id} respondeu outra coisa: ${JSON.stringify(p.r).slice(0, 120)}`));
      // a mesma vista noutro "aparelho" (o mesmo banco)
      const B = await V.espera(SS.abrir(cod, Object.assign({ rede: A.rede.outroCliente(), eu: 0 }, base)));
      ok(JSON.stringify(B.ver().camp.rodadas.map(R => R.jogos.map(g => [g.id, g.a, g.b, g.placar, g.venc]))) === JSON.stringify(c.rodadas.map(R => R.jogos.map(g => [g.id, g.a, g.b, g.placar, g.venc]))) && B.ver().camp.campeao === c.campeao && !B.alterada, `${id}: outro aparelho viu outro campeonato`);
      // a partida gravada para o 2D
      const pt = A.partida(todos[0].id);
      ok(pt && pt.times.length === 2 && pt.times[0].players.length === 11 && pt.times[0].id === "leilao_" + cod + "_" + todos[0].a && pt.res === todos[0].res, `${id}: partida() para o 2D`);
      B.parar(); A.parar();
      ok(SS.salas({ armazem: arm }).some(x => x.codigo === cod && x.estado === "fim" && x.formato === formato), `${id}: Minhas salas com o estado 'fim'`);
    }
    nota(`K1 ${PLANO.length} treinos, ${nJogos} jogos (${nPedido} pelo Simular, ${nPrazo} pelo prazo)`);

    /* ---- K2 recarregar no meio = os mesmos resultados ---- */
    // o mesmo treino duas vezes (a mesma semente, o mesmo relógio): direto, e parado no meio do prazo do jogo da pessoa
    // na 2ª rodada (os outros jogos dela feitos) e aberto de novo pelo armazém — o mesmo campeonato, jogo a jogo
    async function treinoK2(parar) {
      const V = relogioVirtual(), arm = armazemFalso(), cod = "K2MIST";
      const base = { relogio: V.relogio, agendar: V.agendar, cancelar: V.cancelar, armazem: arm, semAtual: true, mundo };
      let A = await V.espera(SS.criarTreino(Object.assign({ liga: "en", bots: 5, semente: "K2", codigo: cod, formato: "misto", tempo: 10 }, base)));
      await V.anda(() => A.sala && A.sala.meta.estado === "escalacao");
      await V.espera(A.prontoEscalacao(true));
      let parou = null;
      if (parar) {
        const achou = await V.anda(() => {
          const c = A.ver().camp, mj = c && c.meuJogo;
          return !!(c && c.rodada && c.rodada.n === parar && mj && mj.e === "aberto" && mj.prazo && !mj.prazo.parado && mj.prazo.restante > 30000 && c.rodada.jogos.filter(g => g.e !== "feito").length === 1);
        });
        ok(achou, "K2: o jogo da pessoa da 2ª rodada nunca ficou aberto sozinho");
        parou = { hora: A.hora(), feitos: JSON.stringify(A.jogos), rodada: A.ver().camp.rodada.n };
        A.parar();
        await V.anda(null, 50);
        V.hora += 3_600_000;                       // uma hora depois (o relógio do treino parou com a página)
        A = await V.espera(SS.abrir(cod, base));
        ok(Math.abs(A.hora() - parou.hora) < 2 && JSON.stringify(A.jogos) === parou.feitos && A.ver().camp.rodada.n === parou.rodada, `K2: reaberto em outro ponto (${A.hora() - parou.hora} ms; rodada ${A.ver().camp && A.ver().camp.rodada.n})`);
      }
      await V.anda(() => A.sala && A.sala.meta.estado === "fim");
      const out = { jogos: A.jogos, fim: A.sala.meta.estado === "fim", campeao: A.ver().camp.campeao, alterada: A.alterada };
      A.parar();
      return out;
    }
    {
      const direto = await treinoK2(0), recarregado = await treinoK2(2);
      ok(direto.fim && recarregado.fim && !direto.alterada && !recarregado.alterada, "K2: algum treino não chegou ao fim");
      const ks = Object.keys(direto.jogos).sort();
      ok(ks.length === LC.jogosDe("misto", 6) && JSON.stringify(ks) === JSON.stringify(Object.keys(recarregado.jogos).sort()), "K2: outros jogos depois de recarregar");
      const dif = ks.filter(k => LC.canon(direto.jogos[k]) !== LC.canon(recarregado.jogos[k]));
      ok(!dif.length && direto.campeao === recarregado.campeao, `K2: recarregar no meio mudou ${dif.length} jogos (${dif.slice(0, 4).join(", ")}) e o campeão ${direto.campeao} → ${recarregado.campeao}`);
    }

    /* ---- K3 a escalação mudada vale a partir do próximo jogo que não começou ---- */
    {
      const V = relogioVirtual(), arm = armazemFalso(), cod = "K3ESCA";
      const base = { relogio: V.relogio, agendar: V.agendar, cancelar: V.cancelar, armazem: arm, semAtual: true, mundo };
      const A = await V.espera(SS.criarTreino(Object.assign({ liga: "br", bots: 3, semente: "K3", codigo: cod, formato: "pontos", tempo: 10 }, base)));
      await V.anda(() => A.sala && A.sala.meta.estado === "escalacao");
      const time = Lx.timeDe(A.vivoN, A.ctx, 0), cabem = Lx.formacoesQueCabem(Lx.contaMascaras(time));
      ok(cabem.length >= 2, "K3: o time da pessoa cabe em menos de 2 formações: " + cabem);
      // F1 no saguão da escalação, F2 com o 1º jogo aberto, F3 (= F1, outra que a F2) depois de ele começar
      const [F1, F2] = cabem, F3 = F1;
      await V.espera(A.mudarFormacao(F1));
      await V.espera(A.prontoEscalacao(true));
      // a 1ª rodada abre; o meu jogo fica aberto (o prazo corre): mudo para F2 antes de ele começar
      await V.anda(() => { const mj = A.ver().camp && A.ver().camp.meuJogo; return !!(mj && mj.e === "aberto"); });
      const id1 = A.ver().camp.meuJogo.id, lado1 = A.ver().camp.meuJogo.a === 0 ? 0 : 1;
      await V.espera(A.mudarFormacao(F2));
      // o prazo vence: reservado com a F2; depois de começar, mudo para F3 (vale no próximo)
      await V.anda(() => A.jogos[id1] && A.jogos[id1].e === "feito");
      await V.espera(A.mudarFormacao(F3));
      const e3 = A.escalacao(0), slots = Lx.slotsDe(F3), dfs = slots.map((s, i) => s[0] === "DF" ? i : -1).filter(i => i >= 0);
      await V.espera(A.trocar(dfs[0], dfs[1]));
      const e3b = A.escalacao(0);
      await V.anda(() => { const c = A.ver().camp; return !!(c && c.rodada && c.rodada.n === 2 && c.meuJogo && c.meuJogo.e === "aberto"); });
      const id2 = A.ver().camp.meuJogo.id, lado2 = A.ver().camp.meuJogo.a === 0 ? 0 : 1;
      await V.anda(() => A.jogos[id2] && A.jogos[id2].e === "feito");
      const j1 = A.jogos[id1], j2 = A.jogos[id2];
      ok(j1.esc[lado1].formacao === F2 && j2.esc[lado2].formacao === F3, `K3: as formações gravadas ${j1.esc[lado1].formacao}/${j2.esc[lado2].formacao} (esperado ${F2}/${F3})`);
      ok(e3b.manual && JSON.stringify(j2.esc[lado2].tit) === JSON.stringify(e3b.tit) && JSON.stringify(e3b.tit) !== JSON.stringify(e3.tit), "K3: a troca à mão não foi para o próximo jogo");
      const pt = A.partida(id1);
      ok(pt && pt.times[lado1].formation === F2 && pt.times[lado2 === lado1 ? lado1 : lado1].players.length === 11, "K3: o jogo gravado no 2D com a formação de então");
      A.parar();
    }

    /* ---- K4 a sala adulterada congela (a conferência dos jogos) ---- */
    {
      const V = relogioVirtual(), arm = armazemFalso(), cod = "K4ADUL";
      const base = { relogio: V.relogio, agendar: V.agendar, cancelar: V.cancelar, armazem: arm, semAtual: true, mundo };
      // T = 2 no mata-mata: um jogo só, o da pessoa contra o bot
      const A = await V.espera(SS.criarTreino(Object.assign({ liga: "it", bots: 1, semente: "K4", codigo: cod, formato: "mata", tempo: 10 }, base)));
      await V.anda(() => A.sala && A.sala.meta.estado === "escalacao");
      await V.espera(A.prontoEscalacao(true));
      await V.anda(() => A.jogos.m1j0 && A.jogos.m1j0.e === "aberto");
      A.pausar();                                     // o relógio do treino parado: a sessão não age
      const X = A.rede.outroCliente(), c = A._campCtx();
      const esc = [LC.escalacaoDoJogo(c, 0), LC.escalacaoDoJogo(c, 1)];
      // o reservado honesto (outro aparelho reservou): confere
      await V.espera(X.transacao("jogos/m1j0", cur => LC.reservar(cur, { ab: [0, 1], esc, modo: "simulado", por: -1, motivo: "dono", ts: X.TS }).jogo));
      await V.anda(null, 20);
      ok(A.jogos.m1j0.e === "reservado" && !A.alterada, "K4: o reservado honesto congelou: " + A.alterada);
      // voltar o reservado ao aberto (uma trava nova = outro sorteio, o "jogar de novo"): congela
      await V.espera(X.gravar("jogos/m1j0", { e: "aberto", ini: A.hora(), resta: LC.PRAZO }));
      await V.anda(null, 20);
      ok(A.alterada === "jogos" && A.alteradaJogo && A.alteradaJogo.motivo === "volta" && A.ver().camp && A.ver().camp.alteradaJogo, `K4: o reservado que voltou ao aberto não congelou (${A.alterada} ${JSON.stringify(A.alteradaJogo)})`);
      A.parar();
      // as outras adulterações, cada uma num aparelho que abre a sala (a conferência na carga e ao vivo)
      const arv = A.rede._arvore();
      // (o simulado depende do código da sala: cada caso abre noutro código, com o contexto dele)
      const feito = cc => { const j = LC.reservar(null, { ab: [0, 1], esc, modo: "simulado", por: -1, motivo: "dono", ts: 5 }).jogo; return LC.gravar(j, { trava: 5, res: LC.resultadoDoJogo(cc, "m1j0", j), ts: 6, mata: true }).jogo; };
      const casos = [
        ["o resultado que a semente não dá", (t, cc) => { const j = feito(cc); j.res.events[0].text = "outro"; t.jogos.m1j0 = j; }, "resultado", null],
        ["um id fora do calendário", t => { t.jogos.r9j0 = { e: "aberto", ini: 1, resta: 1000 }; }, "id", null],
        ["os times trocados", t => { t.jogos.m1j0 = LC.reservar(null, { ab: [1, 0], esc: [esc[1], esc[0]], modo: "simulado", por: -1, motivo: "dono", ts: 5 }).jogo; }, "times", null],
        ["o feito que muda depois de visto", (t, cc) => { t.jogos.m1j0 = feito(cc); },
          "feito", no => { no.res.placar = [no.res.placar[0] + 1, no.res.placar[1]]; no.res.score = no.res.placar.slice(); no.res.v = LC.vencedorDe(no.res); return no; }],
        ["os jogos apagados", (t, cc) => { t.jogos.m1j0 = feito(cc); }, "sumiu", () => null]
      ];
      for (const [nome, prepara, motivo, depois] of casos) {
        const cod2 = "K4" + motivo.toUpperCase().slice(0, 4), cc = Object.assign({}, c, { codigo: cod2 });
        const t = JSON.parse(JSON.stringify(arv)); t.jogos = {}; delete t.relogio;
        prepara(t, cc);
        const R1 = Rd.memoria(cod2, { guardar: false, relogio: V.relogio, agendar: V.agendar });
        await V.espera(R1.gravar("", t));
        const B = await V.espera(SS.abrir(R1.codigo, Object.assign({ rede: R1.outroCliente(), eu: 0 }, base)));
        B.pausar();
        await V.anda(null, 20);
        if (depois) {
          ok(!B.alterada, `K4 ${nome}: congelou antes da adulteração (${B.alterada} ${JSON.stringify(B.alteradaJogo)})`);
          const no = depois(JSON.parse(JSON.stringify(t.jogos.m1j0)));
          await V.espera(no == null ? R1.gravar("jogos", null) : R1.gravar("jogos/m1j0", no));
          await V.anda(null, 20);
        }
        ok(B.alterada === "jogos" && B.alteradaJogo && B.alteradaJogo.motivo === motivo, `K4 ${nome}: ${B.alterada} ${JSON.stringify(B.alteradaJogo)} (esperado ${motivo})`);
        B.parar();
      }
    }
  });
}

/* ============================================ KO o campeonato online (a sessão sobre o Firebase falso) ============================================
   A sala montada no banco falso já no fim do leilão (o leilão de cada um é o bloco O) e as sessões online (abrir) em 2, 4 e
   8 "aparelhos", cada um com o seu cliente, a sua latência e o seu relógio: todos veem os mesmos jogos, resultados,
   tabela, chave e campeão; cada jogo é reservado e gravado UMA vez (o servidor falso guarda a história de cada nó); dois
   aparelhos simulando o mesmo jogo ao mesmo tempo dão um resultado só; o prazo da pessoa é pela hora do servidor (os
   relógios ±5 s e o pulo de +60 s depois da calibração: nenhum jogo reservado pelo prazo antes de a pessoa ter 2 min de
   prazo correndo no servidor); quem some (a página escondida) para o prazo e volta; o dono simula os pendentes; quem
   recarrega vê tudo gravado; quem sai da sala conta como bot; a limpeza não apaga a sala no campeonato com atividade
   nos jogos e apaga a do fim 24 h depois; as regras opcionais (o .validate do LEIA-ME) não recusam nenhuma gravação
   honesta; com elas VALENDO, o batimento a caminho de quem acaba de perder o clube é recusado e a sessão não toma isso por
   queda de conexão (o "passar"). Nenhum Firebase de verdade. --caso dois,limpeza,passar,quatro,oito. */
async function testeCampOnline() {
  await blocoAsync("KO", "campeonato online (banco falso): 2, 4 e 8 aparelhos, cada jogo uma vez, o prazo pelo servidor, quem some, o dono, recarregar, quem sai", async (ok, nota) => {
    const TMx = TMs.public, SS = TMx.leilaoSessao, Lx = TMx.leilao, LC = TMx.leilaoCamp, R = TMx.leilaoRede;
    const { BancoFalso } = await import(pathToFileURL(path.join(RAIZ, "ferramentas/lib/banco-falso.mjs")).href);
    const CASOS = opt("--caso", null) ? opt("--caso").split(",") : null, caso = n => !CASOS || CASOS.includes(n);
    // o tempo de mentira (como o do bloco O): o servidor, as agendas das sessões e os relógios andam juntos
    const RT = { hora: 9_000_000, fila: [], seq: 0 };
    const agendar = (fn, ms) => { const e = { at: RT.hora + Math.max(0, +ms || 0), fn, s: RT.seq++, morto: false }; RT.fila.push(e); return e; };
    const cancelar = e => { if (e) e.morto = true; };
    const respira = async () => { for (let i = 0; i < 3; i++) await new Promise(r => setImmediate(r)); };
    let acontecimentos = 0;
    async function anda(pare, limiteMs = 6 * 3600_000) {
      const fim = RT.hora + limiteMs;
      let parado = 0, horaAntes = RT.hora;
      for (let k = 0; k < 6_000_000; k++) {
        if (RT.hora !== horaAntes) { horaAntes = RT.hora; parado = 0; } else if (++parado > 20000) throw new Error("laço sem o tempo andar em " + RT.hora);
        await respira();
        if (pare && pare()) return true;
        if (RT.fila.length > 4000) RT.fila = RT.fila.filter(e => !e.morto);
        let m = -1;
        for (let i = 0; i < RT.fila.length; i++) { const e = RT.fila[i]; if (e.morto) continue; if (m < 0 || e.at < RT.fila[m].at || (e.at === RT.fila[m].at && e.s < RT.fila[m].s)) m = i; }
        if (m < 0 || RT.fila[m].at > fim) {
          for (let i = 0; i < 4; i++) await respira();
          if (pare && pare()) return true;
          if (RT.fila.some(e => !e.morto && e.at <= fim)) continue;
          RT.hora = Math.max(RT.hora, fim);
          return !!(pare && pare());
        }
        const e = RT.fila.splice(m, 1)[0];
        RT.hora = Math.max(RT.hora, e.at); acontecimentos++;
        try { e.fn(); } catch (er) { ok(false, "exceção num acontecimento: " + (er && er.stack || er)); }
      }
      return false;
    }
    const passa = ms => anda(null, ms);
    async function espera(p, limiteMs = 120_000) {
      let feito = false, val, err;
      p.then(v => { feito = true; val = v; }, e => { feito = true; err = e; });
      await anda(() => feito, limiteMs);
      if (!feito) throw new Error("a promessa não resolveu em " + limiteMs + " ms");
      if (err) throw err;
      return val;
    }
    const banco = new BancoFalso({ relogio: () => RT.hora, tempo: () => RT.hora, agendar });
    // ---------- as regras opcionais (o .validate do LEIA-ME) avaliadas em cada gravação, sem recusar: o fluxo honesto do
    // campeonato não pode ser recusado por elas ----------
    const confereRegras = avaliadorRegras(path.join(RAIZ, "firebase/regras-leilao-validate.json")), recusas = [];
    let gravacoes = 0;
    banco.negar = (op, caminho, valor, C) => {
      const ps = String(caminho).split("/").filter(Boolean);
      if (ps[0] !== "leiloes") return false;
      gravacoes++;
      const f = confereRegras(banco.raiz, ps, valor, banco.relogio(), C ? C.uid : null);
      if (f.length) recusas.push({ op, caminho, f });
      return false;
    };
    // ---------- o servidor guarda a história de cada jogo (a hora do servidor de cada mudança do nó) e a de cada
    // batimento (a presença de cada conta: os `ts` que o servidor pôs) ----------
    const HIST = {};   // código → { ult: { id: canon }, log: { id: [{ hora, j }] }, bates: { uid: [ts] } }
    const escreveOrig = banco._escreve.bind(banco);
    banco._escreve = itens => {
      const toca = [], bts = [];
      for (const [ps] of itens) {
        if (ps[0] === "leiloes" && HIST[ps[1]] && (ps.length <= 2 || ps[2] === "jogos")) toca.push(ps);
        if (ps[0] === "leiloes" && HIST[ps[1]] && ps[2] === "bate" && ps.length >= 4) bts.push(ps);
      }
      escreveOrig(itens);
      for (const ps of bts) {
        const b = banco.ler("leiloes/" + ps[1] + "/bate/" + ps[3]), H = HIST[ps[1]], L = (H.bates[ps[3]] = H.bates[ps[3]] || []);
        if (b && typeof b.ts === "number" && L[L.length - 1] !== b.ts) L.push(b.ts);
      }
      for (const ps of toca) {
        const H = HIST[ps[1]], ids = ps.length >= 4 ? [ps[3]] : [...new Set(Object.keys(banco.ler("leiloes/" + ps[1] + "/jogos") || {}).concat(Object.keys(H.ult)))];
        for (const id of ids) {
          const j = banco.ler("leiloes/" + ps[1] + "/jogos/" + id), c = LC.canon(j);
          if (H.ult[id] === c) continue;
          H.ult[id] = c; (H.log[id] = H.log[id] || []).push({ hora: RT.hora, j });
        }
      }
    };
    // ---------- os aparelhos (como os do bloco O) ----------
    let nAp = 0;
    function documento() { const d = { hidden: false, ouvintes: [], addEventListener(n, f) { if (n === "visibilitychange") this.ouvintes.push(f); }, removeEventListener(n, f) { this.ouvintes = this.ouvintes.filter(x => x !== f); }, esconde(sim) { this.hidden = sim; this.ouvintes.slice().forEach(f => f()); } }; return d; }
    function aparelho(uid, o = {}) {
      nAp++;
      const dev = { uid, desvio: o.desvio || 0, arm: armazemFalso(), doc: documento() };
      dev.cli = banco.cliente({ uid: "auth-" + uid, latencia: o.latencia ?? 20, relogio: () => RT.hora + dev.desvio });
      dev.mono = { base: 30_000 + nAp * 977, pulo: 0 };
      dev.redePara = codigo => R.firebase(codigo, { db: dev.cli.db, firebase: dev.cli.firebase, relogio: () => RT.hora - 9_000_000 + dev.mono.base + dev.mono.pulo, relogioParede: () => RT.hora + dev.desvio });
      dev.opc = extra => Object.assign({
        id: { uid, auth: "auth-" + uid, nome: "Pessoa " + uid.toUpperCase(), num: "2000-" + String(nAp).padStart(4, "0") },
        redePara: dev.redePara, edicao: () => "public", suUnlocked: () => false, trocarEdicao: ed => ed, fairplay: () => false,
        armazem: dev.arm, agendar, cancelar, mundo: MUNDO.public, doc: dev.doc, semAtual: true
      }, extra || {});
      dev.abrir = codigo => espera(SS.abrir(codigo, dev.opc({ online: true })));
      dev.bytes = () => banco.bytes(dev.cli.cid);
      return dev;
    }
    // a sala no fim do leilão, gravada direto no servidor (o leilão de robôs da máquina pura: o bloco O testa o leilão)
    const CORES = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#14b8a6", "#ec4899"];
    function salaPronta(cod, uids, nb, formato, liga, semente) {
      const T = uids.length + nb, { lotes, fora } = lotesDe("public", liga, T);
      const ctx = Lx.contexto({ T, lotes, fora, semente }), fim = leilaoRobos(ctx).v;
      const sala = {
        meta: { dono: uids[0], proto: SS.PROTO, regras: Lx.REGRAS, versaoTM: "", edicao: "public", criada: RT.hora, estado: "escalacao", semente, atividade: RT.hora, fimLeilao: RT.hora },
        cfg: { liga, ligaNome: liga, vagas: T, bots: nb, tempo: 10000, formato, overall: "mostra", T }, tec: {}
      };
      uids.forEach((u, i) => { sala.tec[u] = { nome: "Pessoa " + u.toUpperCase(), num: "2000-000" + i, papel: i ? "tecnico" : "dono", pronto: true, auth: "auth-" + u, entrou: i, clube: { nome: "Clube " + u.toUpperCase(), sigla: u.toUpperCase().slice(0, 3), cor: CORES[i], escudo: "classico|star" }, formacao: "4-4-2" }; });
      SS._sala.refazBots(sala);
      sala.ordem = SS._sala.ordemPrevista(sala);
      HIST[cod] = { ult: {}, log: {}, bates: {} };
      banco.gravar("leiloes/" + cod, { sala, lotes: { l: lotes, f: fora, T, liga, ed: "public" }, vivo: fim });
      return { T, ordem: sala.ordem, ctx, fim, sala };
    }
    // a vista resumida (o que todo aparelho tem de ver igual)
    const resumo = S => { const c = S.ver().camp; return c ? JSON.stringify({ r: c.rodadas.map(R0 => R0.jogos.map(g => [g.id, g.a, g.b, g.e, g.placar, g.venc])), t: c.tabela && c.tabela.map(x => [x.t, x.pts, x.sg, x.gp]), c: c.campeao, cl: c.classificacao, a: c.artilharia.slice(0, 5).map(x => [x.id, x.gols]), f: c.fim }) : "sem camp"; };
    // a história de cada jogo no servidor: uma reserva, um resultado e nada depois; o prazo da pessoa com 2 min correndo
    function confereHist(cod, S, id, conta, so) {
      const H = HIST[cod], c = S.ver().camp, ctxC = S._campCtx();
      c.rodadas.forEach(R0 => R0.jogos.forEach(g => {
        if (so && !so.includes(g.id)) return;
        const L = H.log[g.id] || [], res = L.filter(x => x.j && x.j.e === "reservado"), fe = L.filter(x => x.j && x.j.e === "feito");
        ok(res.length === 1 && fe.length === 1 && L[L.length - 1].j && L[L.length - 1].j.e === "feito", `${id}: ${g.id} com ${res.length} reservas e ${fe.length} resultados no servidor`);
        if (!res.length || !fe.length) return;
        const jr = res[0].j, jf = fe[0].j;
        ok(jf.trava === jr.trava && LC.canon(jf.esc) === LC.canon(jr.esc) && LC.conferirJogo(ctxC, g, jf) === null, `${id}: ${g.id} gravado com outra trava, escalação ou resultado`);
        conta[jr.motivo] = (conta[jr.motivo] || 0) + 1;
        const k = L.indexOf(res[0]);
        let corre = 0;
        for (let i = 0; i < k; i++) if (L[i].j && L[i].j.e === "aberto" && !L[i].j.parado) corre += L[i + 1].hora - L[i].hora;
        L.slice(0, k).forEach(x => { if (x.j && x.j.e === "aberto" && x.j.parado) conta.pausas = (conta.pausas || 0) + 1; });
        if (jr.motivo === "prazo") {
          const ant = k > 0 ? L[k - 1].j : null;
          ok(ant && ant.e === "aberto" && !ant.parado && ant.ini + ant.resta <= res[0].hora, `${id}: ${g.id} reservado pelo prazo ANTES de vencer pela hora do servidor (${ant ? ant.ini + ant.resta - res[0].hora : "?"} ms)`);
          ok(corre >= LC.PRAZO, `${id}: ${g.id} reservado pelo prazo com só ${corre / 1000} s de prazo correndo no servidor`);
          const pres = presenteCorrendo(cod, S, g, L, k);
          if (pres != null) {
            conta.presMin = Math.min(conta.presMin ?? Infinity, Math.round(pres / 100) / 10);
            ok(pres >= LC.PRAZO - 1000, `${id}: ${g.id} reservado pelo prazo com a pessoa presente só ${(pres / 1000).toFixed(1)} s do prazo correndo (pelos batimentos dela no servidor)`);
          }
        }
      }));
    }
    // quanto do prazo correndo (o nó aberto e não parado, pela história do servidor, até a reserva k) a pessoa do jogo
    // esteve PRESENTE pelos batimentos dela no servidor (presente entre dois bates com no máximo 12 s um do outro, e do
    // último bate até a reserva quando ele tem no máximo 12 s); null = não é o jogo de uma pessoa contra um bot ou ela saiu
    // da sala
    function presenteCorrendo(cod, S, g, L, k) {
      const c = S._campCtx(), ordem = S._ordem();
      if (LC.confronto(c, g) !== "pessoaBot") return null;
      const p = c.tipos[g.a] === "pessoa" ? g.a : g.b, uid = ordem[p], tc = S.sala.tec[uid];
      if (!tc || tc.saiu) return null;
      const R = L[k].hora, B = (HIST[cod].bates[uid] || []).filter(x => x <= R).sort((x, y) => x - y), pres = [];
      for (let i = 0; i + 1 < B.length; i++) if (B[i + 1] - B[i] <= 12000) pres.push([B[i], B[i + 1]]);
      if (B.length && R - B[B.length - 1] <= 12000) pres.push([B[B.length - 1], R]);
      let soma = 0;
      for (let i = 0; i < k; i++) {
        const x = L[i].j; if (!x || x.e !== "aberto" || x.parado) continue;
        const a = L[i].hora, b = L[i + 1].hora;
        for (const [p0, p1] of pres) soma += Math.max(0, Math.min(b, p1) - Math.max(a, p0));
      }
      return soma;
    }
    // a pessoa: simula o próprio jogo quando a regra diz (2 s depois de ver o jogo aberto)
    function pilotoOnline(S, simula) {
      const visto = new Set(), resp = [];
      let parado = false;
      const off = S.aoMudar(() => {
        if (parado) return;
        const c = S.ver().camp, mj = c && c.meuJogo;
        if (!mj || !mj.podeSimular || visto.has(mj.id) || !simula(mj)) return;
        visto.add(mj.id);
        agendar(() => { if (!parado) S.simular(mj.id).then(r => resp.push({ id: mj.id, r })); }, 2000);
      });
      return { parar() { parado = true; off(); }, resp };
    }
    // o dono: "Simular os pendentes" quando a rodada só espera por quem sumiu (o prazo parado, ou o jogo nem aberto)
    const DEP = {}, chamadas = {};
    function vigiaDono(S0, sumidos, conta) {
      let parado = false;
      const olha = () => {
        if (parado) return;
        const c = S0.ver().camp;
        if (c && !c.fim && c.pendentes) {
          const pend = c.rodada.jogos.filter(g => g.e !== "feito");
          const soSumidos = pend.every(g => (g.j && g.j.e === "aberto" && g.j.parado) || (!g.j && [g.a, g.b].some(t => sumidos.has(t))));
          if (soSumidos) { conta.dono = (conta.dono || 0) + 1; S0.simularPendentes(); }
        }
        agendar(olha, 30_000);
      };
      agendar(olha, 30_000);
      return { parar() { parado = true; } };
    }
    try {
      /* ---------- dois: 2 pessoas + 2 bots no mata-mata; dois aparelhos simulando o mesmo jogo; recarregar ---------- */
      if (caso("dois")) {
        const id = "KO dois", conta = {};
        // a semente em que a 2ª pessoa (t = 1) joga contra um bot na 1ª rodada
        let sem = null;
        for (let k = 0; k < 100 && !sem; k++) { const c = LC.contexto({ formato: "mata", T: 4, semente: "KOd" + k }), j = LC.estrutura(c)[0].jogos.find(x => x.src.some(s => s.t === 1)); if (j && j.src.some(s => s.t >= 2)) sem = "KOd" + k; }
        salaPronta("KODOIS", ["d0", "d1"], 2, "mata", "it", sem);
        const A = aparelho("d0", { latencia: 15 }), B = aparelho("d1", { latencia: 60, desvio: 5000 });
        const SA = await A.abrir("KODOIS");
        let SB = await B.abrir("KODOIS");
        await anda(() => SA.sala.meta.estado === "camp" && SB.sala.meta.estado === "camp", 200_000);
        ok(SA.sala.meta.estado === "camp" && typeof SA.sala.meta.camp === "number", `${id}: a escalação não passou ao campeonato em 60 s`);
        // o jogo da 2ª pessoa abre (o prazo corre) e ela some (a página escondida): o prazo para e o jogo passa a esperar por
        // ela. Ela volta e toca em Simular no MESMO instante em que o dono — que ainda não viu a volta (a rede dele chega
        // 2 s atrasada) — toca em "Simular os pendentes": duas transações no mesmo jogo
        await anda(() => { const mj = SB.ver().camp && SB.ver().camp.meuJogo; return !!(mj && mj.e === "aberto" && mj.podeSimular); }, 60_000);
        const idB = SB.ver().camp.meuJogo.id;
        B.doc.esconde(true);
        const esperou = await anda(() => { const j = SA.jogos[idB], c = SA.ver().camp; return !!(j && j.e === "aberto" && j.parado && c.podePendentes && c.pendLista.some(x => x.id === idB)); }, 60_000);
        banco.definirLatencia(A.cli.cid, { sobe: 15, desce: 2000 });
        B.doc.esconde(false);
        await anda(() => { const mj = SB.ver().camp.meuJogo; return !!(mj && mj.podeSimular); }, 60_000);
        const aindaPend = SA.ver().camp.pendLista.some(x => x.id === idB);
        const pB = SB.simular(), pA = SA.simularPendentes();
        const [rB, rA] = await espera(Promise.all([pB, pA]));
        banco.definirLatencia(A.cli.cid, 15);
        ok(esperou && aindaPend && rB.ok && rA.ok && rB.jogo && rB.jogo.e === "feito", `${id}: as respostas da corrida: ${JSON.stringify([esperou, aindaPend, rB.estado, rB.motivo, rA.estado, rA.motivo])}`);
        await passa(2000);
        const L = HIST.KODOIS.log[idB] || [];
        ok(L.filter(x => x.j && x.j.e === "reservado").length === 1 && L.filter(x => x.j && x.j.e === "feito").length === 1, `${id}: a corrida no mesmo jogo deu ${L.length} mudanças no servidor`);
        ok(LC.canon(rB.res) === LC.canon(SA.jogos[idB].res) && LC.canon(SB.jogos[idB].res) === LC.canon(SA.jogos[idB].res), `${id}: os dois viram resultados diferentes`);
        // o 2º aparelho recarrega no meio (fecha e abre de novo): vê tudo gravado e segue
        SB.parar(); await passa(20_000);
        SB = await B.abrir("KODOIS");
        ok(resumo(SB) === resumo(SA), `${id}: quem recarregou viu outro campeonato`);
        await anda(() => SA.sala.meta.estado === "fim" && SB.sala.meta.estado === "fim", 3600_000);
        ok(SA.sala.meta.estado === "fim" && SB.sala.meta.estado === "fim", `${id}: não acabou (${SA.sala.meta.estado}/${SB.sala.meta.estado})`);
        ok(resumo(SA) === resumo(SB) && SA.ver().camp.campeao != null && !SA.alterada && !SB.alterada, `${id}: vistas diferentes no fim ou sala congelada (${SA.alterada}/${SB.alterada} ${JSON.stringify(SA.alteradaJogo || SB.alteradaJogo)})`);
        confereHist("KODOIS", SA, id, conta);
        ok((conta.pedido || 0) + (conta.dono || 0) >= 1, `${id}: ninguém simulou pela tela: ${JSON.stringify(conta)}`);
        nota(`dois: ${JSON.stringify(conta)}`);
        SA.parar(); SB.parar();
      }

      /* ---------- limpeza: a sala no campeonato com atividade nos jogos não some; a do fim, 24 h depois, some ---------- */
      if (caso("limpeza")) {
        const id = "KO limpeza", H = 3600_000;
        RT.hora = Math.max(RT.hora, 40 * H);         // (as horas "de 25 h atrás" precisam de um relógio que já passou delas)
        // uma sala no camp com a meta de 25 h atrás e um jogo gravado há 2 h (a atividade do campeonato mora nos jogos)
        const P1 = salaPronta("KOLIMP", ["l0", "l1"], 2, "mata", "es", "KOl"), s1 = P1.sala;
        // (o contexto como o da sessão: os clubes e os técnicos da sala entram no texto dos lances)
        const ctxDaSala = (P, cod, sem, T) => LC.contexto({ codigo: cod, semente: sem, formato: "mata", T, ctx: P.ctx, vivo: P.fim,
          clubes: P.ordem.map(u => P.sala.tec[u].clube), nomes: P.ordem.map(u => P.sala.tec[u].nome), tipos: P.ordem.map(u => P.sala.tec[u].papel === "bot" ? "bot" : "pessoa") });
        const c1 = ctxDaSala(P1, "KOLIMP", "KOl", 4);
        const g1 = LC.montar(c1, {}).rodadas[0].jogos[0];
        const j1 = LC.reservar(null, { ab: [g1.a, g1.b], esc: [LC.escalacaoDoJogo(c1, g1.a), LC.escalacaoDoJogo(c1, g1.b)], modo: "simulado", por: -1, motivo: "dono", ts: RT.hora - 2 * H }).jogo;
        const f1 = LC.gravar(j1, { trava: j1.trava, res: LC.resultadoDoJogo(c1, g1.id, j1), ts: RT.hora - 2 * H + 1000, mata: true }).jogo;
        Object.assign(s1.meta, { estado: "camp", camp: RT.hora - 25 * H, atividade: RT.hora - 25 * H, criada: RT.hora - 26 * H, fimLeilao: RT.hora - 25 * H - 60_000 });
        banco.gravar("leiloes/KOLIMP/sala", s1); banco.gravar("leiloes/KOLIMP/jogos/" + g1.id, f1);
        // uma sala no fim, tudo de 25 h atrás: some
        const P2 = salaPronta("KOLIM2", ["n0", "n1"], 0, "mata", "es", "KOn"), s2 = P2.sala;
        const c2 = ctxDaSala(P2, "KOLIM2", "KOn", 2);
        const g2 = LC.montar(c2, {}).rodadas[0].jogos[0];
        const j2 = LC.reservar(null, { ab: [g2.a, g2.b], esc: [LC.escalacaoDoJogo(c2, g2.a), LC.escalacaoDoJogo(c2, g2.b)], modo: "simulado", por: -1, motivo: "abertura", ts: RT.hora - 25 * H }).jogo;
        const f2 = LC.gravar(j2, { trava: j2.trava, res: LC.resultadoDoJogo(c2, g2.id, j2), ts: RT.hora - 25 * H + 1000, mata: true }).jogo;
        Object.assign(s2.meta, { estado: "fim", camp: RT.hora - 25 * H - 5000, fimCamp: RT.hora - 25 * H + 2000, atividade: RT.hora - 25 * H + 2000, criada: RT.hora - 26 * H, fimLeilao: RT.hora - 25 * H - 70_000 });
        banco.gravar("leiloes/KOLIM2/sala", s2); banco.gravar("leiloes/KOLIM2/jogos/" + g2.id, f2);
        // uma sala no campeonato PARADA há 25 h (o jogo do dono, que sumiu, esperando; a outra pessoa abre e fica): com
        // alguém na sala, o campeonato em andamento não some
        const P3 = salaPronta("KOLIM3", ["m0", "m1"], 2, "mata", "es", "KOm"), s3 = P3.sala;
        const c3 = ctxDaSala(P3, "KOLIM3", "KOm", 4), g3 = LC.montar(c3, {}).rodadas[0].jogos.find(g => g.a !== 0 && g.b !== 0) || LC.montar(c3, {}).rodadas[0].jogos[1];
        const j3 = LC.reservar(null, { ab: [g3.a, g3.b], esc: [LC.escalacaoDoJogo(c3, g3.a), LC.escalacaoDoJogo(c3, g3.b)], modo: "simulado", por: -1, motivo: "abertura", ts: RT.hora - 25 * H }).jogo;
        const f3 = LC.gravar(j3, { trava: j3.trava, res: LC.resultadoDoJogo(c3, g3.id, j3), ts: RT.hora - 25 * H + 1000, mata: true }).jogo;
        Object.assign(s3.meta, { estado: "camp", camp: RT.hora - 25 * H - 5000, atividade: RT.hora - 25 * H, criada: RT.hora - 26 * H, fimLeilao: RT.hora - 25 * H - 70_000 });
        banco.gravar("leiloes/KOLIM3/sala", s3); banco.gravar("leiloes/KOLIM3/jogos/" + g3.id, f3);
        const S1 = await aparelho("l1", { latencia: 30 }).abrir("KOLIMP"), S2 = await aparelho("n1", { latencia: 30 }).abrir("KOLIM2"), S3 = await aparelho("m1", { latencia: 30 }).abrir("KOLIM3");
        await passa(120_000);
        ok(banco.ler("leiloes/KOLIMP/sala") && !S1.apagada && !S1.alterada, `${id}: a sala no campeonato com um jogo gravado há 2 h sumiu (${S1.alterada})`);
        ok(!banco.ler("leiloes/KOLIM2/sala") && S2.apagada, `${id}: a sala do fim de 25 h atrás não sumiu (${S2.alterada} ${JSON.stringify(S2.alteradaJogo)})`);
        ok(banco.ler("leiloes/KOLIM3/sala") && !S3.apagada && !S3.alterada, `${id}: o campeonato parado há 25 h sumiu com alguém dentro da sala (${S3.alterada})`);
        S1.parar(); S2.parar(); S3.parar();
      }

      /* ---------- passar: com as regras opcionais VALENDO, o dono passa o clube no instante em que o batimento do aparelho
         velho está a caminho: o servidor o recusa (sem permissão: a conta já não é da sala) e o aparelho velho, que só olha,
         não fica em "Reconectando…" (a recusa por permissão não é queda de conexão) ---------- */
      if (caso("passar")) {
        const id = "KO passar", cod = "KOPASS";
        salaPronta(cod, ["p0", "p1"], 2, "mata", "it", "KOp");
        const A = aparelho("p0", { latencia: 15 }), B = aparelho("p1", { latencia: 20 }), N = aparelho("p9", { latencia: 20 });
        const negarAntes = banco.negar;
        let negadas = 0;
        banco.negar = (op, caminho, valor, C) => {
          const ps = String(caminho).split("/").filter(Boolean);
          if (ps[0] === "leiloes" && ps[1] === cod && (ps[2] === "bate" || ps[2] === "pres") && confereRegras(banco.raiz, ps, valor, banco.relogio(), C ? C.uid : null).length) { negadas++; return true; }
          return negarAntes(op, caminho, valor, C);
        };
        try {
          const SA = await A.abrir(cod), SB = await B.abrir(cod);
          await passa(12_000);
          // a conta nova (outro aparelho da mesma pessoa) pede pelo código: o pedido "depois" do Começar
          const SN = await espera(SS.entrar(cod, N.opc({ online: true })));
          await anda(() => !!(SA.sala.pedidos && SA.sala.pedidos.p9), 30_000);
          // o batimento do velho a caminho (1,5 s para subir; o ack em menos de 3 s): o dono passa o clube nesse instante
          banco.definirLatencia(B.cli.cid, { sobe: 1500, desce: 20 });
          await anda(() => SB._bateEmVoo, 30_000);
          const em = SB._bateEmVoo, r = await espera(SA.passarClube("p1", "p9"));
          await passa(12_000);
          banco.definirLatencia(B.cli.cid, 20);
          await passa(12_000);
          ok(em && r.ok && SB.eu === -1 && SN.eu === 1 && negadas >= 1, `${id}: o clube não passou com o batimento a caminho (${JSON.stringify({ em, r, eu: SB.eu, novo: SN.eu, negadas })})`);
          ok(SB._estadoRede() === "ok" && SB.ver().rede === "ok", `${id}: o aparelho velho ficou em '${SB._estadoRede()}' depois da recusa do batimento a caminho`);
          SA.parar(); SB.parar(); SN.parar();
        } finally { banco.negar = negarAntes; }
      }

      /* ---------- quatro: 4 pessoas + 2 bots no misto; ±5 s, o pulo de +60 s, quem some e volta, quem some e o dono ---------- */
      if (caso("quatro")) {
        const id = "KO quatro", conta = {}, cod = "KOQUAT";
        const { ordem } = salaPronta(cod, ["q0", "q1", "q2", "q3"], 2, "misto", "br", "KOq"), t0q = RT.hora;
        const devs = ["q0", "q1", "q2", "q3"].map((u, k) => aparelho(u, { latencia: [0, 25, 70, 140][k], desvio: [0, 5000, -5000, 0][k] }));
        const Ss = [];
        for (const d of devs) Ss.push(await d.abrir(cod));
        // o relógio de parede do 4º pula +60 s depois da calibração
        await anda(() => Ss[3].rede._hora().escolhida, 30_000);
        devs[3].desvio += 60_000;
        await anda(() => Ss.every(S => S.sala.meta.estado === "camp"), 200_000);
        const pils = [pilotoOnline(Ss[1], mj => mj.rodada % 2 === 0)];
        // o 3º some 70 s quando o prazo do jogo dele contra um bot está correndo (duas vezes); o 4º some de vez na 3ª rodada
        let some3 = 0, sumiu4 = false;
        const sumidos = new Set();
        const offs = [Ss[2].aoMudar(() => {
          const c = Ss[2].ver().camp, mj = c && c.meuJogo;
          if (some3 < 2 && mj && mj.e === "aberto" && mj.prazo && !mj.prazo.parado && mj.contraBot && !devs[2].doc.hidden) {
            some3++; devs[2].doc.esconde(true);
            agendar(() => devs[2].doc.esconde(false), 70_000);
          }
        }), Ss[0].aoMudar(() => {
          const c = Ss[0].ver().camp;
          if (!sumiu4 && c && c.rodada && c.rodada.n >= 3) { sumiu4 = true; sumidos.add(3); devs[3].doc.esconde(true); }
        })];
        const dono = vigiaDono(Ss[0], sumidos, chamadas);
        if (process.env.KO_DEPURA) Ss.forEach((S, k) => { const o = S._acao.bind(S); S._acao = (tipo, a) => { const x = k + ":" + tipo + ":" + (a.acao || ""); DEP[x] = (DEP[x] || 0) + 1; return o(tipo, a); }; });
        await anda(() => Ss.slice(0, 3).every(S => S.sala.meta.estado === "fim"), 6 * 3600_000);
        dono.parar(); pils.forEach(p => p.parar()); offs.forEach(f => f());
        ok(Ss.slice(0, 3).every(S => S.sala.meta.estado === "fim"), `${id}: não acabou (${Ss.map(S => S.sala.meta.estado)}; rodada ${Ss[0].ver().camp && Ss[0].ver().camp.rodada && Ss[0].ver().camp.rodada.n})`);
        // quem sumiu volta e vê tudo gravado
        devs[3].doc.esconde(false);
        await passa(30_000);
        ok(Ss.every(S => resumo(S) === resumo(Ss[0])) && Ss.every(S => !S.alterada), `${id}: vistas diferentes ou sala congelada (${Ss.map(S => S.alterada)})`);
        confereHist(cod, Ss[0], id, conta);
        ok((conta.pausas || 0) > 0 && (conta.prazo || 0) > 0 && (conta.dono || 0) > 0, `${id}: o prazo parado, o prazo vencido e o dono não foram exercitados: ${JSON.stringify(conta)}`);
        ok(some3 > 0 && sumiu4, `${id}: ninguém sumiu (${some3}, ${sumiu4})`);
        nota(`quatro: ${JSON.stringify(conta)} (o dono simulou os pendentes ${chamadas.dono || 0}×), ${ordem.length} técnicos, ${((RT.hora - t0q) / 60000).toFixed(0)} min de campeonato`);
        if (process.env.KO_DEPURA) console.log(JSON.stringify(DEP));
        Ss.forEach(S => S.parar());
      }

      /* ---------- oito: 8 pessoas nos pontos corridos (56 jogos); quem sai da sala conta como bot ---------- */
      if (caso("oito")) {
        const id = "KO oito", conta = {}, cod = "KOOITO", uids = ["o0", "o1", "o2", "o3", "o4", "o5", "o6", "o7"];
        salaPronta(cod, uids, 0, "pontos", "de", "KOo");
        const devs = uids.map((u, k) => aparelho(u, { latencia: k === 7 ? 10 : 20 + k * 20, desvio: (k % 3 - 1) * 5000 }));
        const Ss = [];
        for (const d of devs) Ss.push(await d.abrir(cod));
        // o 8º sai da sala quando a 2ª rodada abre: os jogos das rodadas que abrem depois disso andam como os de um bot (o
        // prazo do adversário); antes, como os de uma pessoa (simulados na abertura)
        let pSai = null;
        const offSai = Ss[0].on("rodada", x => { if (x.n === 2 && !pSai) pSai = Ss[7].sair(); });
        await anda(() => !!pSai, 3600_000);
        offSai();
        if (!ok(pSai, `${id}: a 2ª rodada não abriu`)) throw new Error("oito: sem a 2ª rodada");
        await espera(pSai);
        const tSaiu = RT.hora;
        const vivos = Ss.slice(0, 7);
        await anda(() => vivos.every(S => S.sala.meta.estado === "fim"), 6 * 3600_000);
        ok(vivos.every(S => S.sala.meta.estado === "fim"), `${id}: não acabou (${vivos.map(S => S.sala.meta.estado)})`);
        ok(vivos.every(S => resumo(S) === resumo(vivos[0])) && vivos.every(S => !S.alterada), `${id}: vistas diferentes ou sala congelada`);
        confereHist(cod, vivos[0], id, conta);
        // os jogos do 8º: 'abertura' antes de sair; depois, o prazo do adversário (não a abertura)
        const c = vivos[0].ver().camp, H = HIST[cod];
        let depois = 0;
        c.rodadas.forEach(R0 => R0.jogos.forEach(g => {
          if (g.a !== 7 && g.b !== 7) return;
          const jr = (H.log[g.id] || []).find(x => x.j && x.j.e === "reservado");
          if (!jr) return;
          if (R0.n === 1) ok(jr.j.motivo === "abertura", `${id}: ${g.id} (antes de sair) por '${jr.j.motivo}'`);
          else if (R0.abre > tSaiu + 1000) { depois++; ok(jr.j.motivo === "prazo", `${id}: ${g.id} (a rodada abriu ${(R0.abre - tSaiu) / 1000} s depois de ele sair) por '${jr.j.motivo}'`); }
        }));
        ok(depois >= 5 && c.rodadas.flatMap(R0 => R0.jogos).length === 56, `${id}: ${depois} jogos depois de sair`);
        const kb = devs.slice(0, 7).map(d => (d.bytes().desce / 1024).toFixed(0));
        nota(`oito: ${JSON.stringify(conta)}; KB baixados por aparelho no campeonato ${kb.join("/")}`);
        vivos.forEach(S => S.parar());
      }

      /* ---------- sozinho: a pessoa sozinha na sala (o outro técnico nunca abriu) some com o prazo correndo e volta: sem
         ninguém para gravar a pausa, o prazo parou mesmo assim no último bate dela (o bate da volta diz que houve um buraco)
         e só vence depois de 2 min com ela presente ---------- */
      if (caso("sozinho")) {
        const id = "KO sozinho", cod = "KOSOZ", conta = {};
        let sem = null;
        for (let k = 0; k < 400 && !sem; k++) { const c = LC.contexto({ formato: "pontos", T: 4, semente: "KOs" + k }), j = LC.estrutura(c)[0].jogos.find(x => x.src.some(s => s.t === 0)); if (j && j.src.some(s => s.t >= 2)) sem = "KOs" + k; }
        salaPronta(cod, ["s0", "s1"], 2, "pontos", "it", sem);
        const A = aparelho("s0", { latencia: 20 }), SA = await A.abrir(cod);
        await anda(() => SA.sala.meta.estado === "camp", 200_000);
        await anda(() => { const mj = SA.ver().camp && SA.ver().camp.meuJogo; return !!(mj && mj.e === "aberto" && mj.prazo && !mj.prazo.parado); }, 60_000);
        const idA = SA.ver().camp.meuJogo.id;
        await passa(5000);
        A.doc.esconde(true); const tSome = RT.hora;
        await passa(300_000);
        const jFora = banco.ler("leiloes/" + cod + "/jogos/" + idA);
        A.doc.esconde(false); const tVolta = RT.hora;
        // de volta: o prazo para no último bate antes do buraco e volta a correr (nada reservado na volta)
        await passa(20_000);
        const jVolta = banco.ler("leiloes/" + cod + "/jogos/" + idA), L0 = HIST[cod].log[idA] || [];
        const pausa = L0.find(x => x.j && x.j.e === "aberto" && x.j.parado);
        ok(jFora && jFora.e === "aberto" && jVolta && jVolta.e === "aberto" && !jVolta.parado && pausa && pausa.hora >= tVolta && pausa.j.resta >= LC.PRAZO - 12_000,
          `${id}: na volta o jogo não parou no último bate antes do buraco (${JSON.stringify({ fora: jFora, volta: jVolta, pausa: pausa && { seg: (pausa.hora - tVolta) / 1000, resta: pausa.j.resta } })})`);
        // e vence pelo prazo só depois de ela ficar presente o que restava
        await anda(() => { const j = SA.jogos[idA]; return !!(j && j.e === "feito"); }, 600_000);
        const L = HIST[cod].log[idA] || [], jr = L.find(x => x.j && x.j.e === "reservado");
        ok(jr && jr.j.motivo === "prazo" && jr.hora > tSome && (jr.hora - tVolta) >= (pausa ? pausa.j.resta : LC.PRAZO) - 1000,
          `${id}: reservado ${jr ? ((jr.hora - tVolta) / 1000).toFixed(1) + " s depois da volta por '" + jr.j.motivo + "'" : "nunca"} (restavam ${pausa ? pausa.j.resta / 1000 : "?"} s)`);
        confereHist(cod, SA, id, conta, [idA]);
        nota(`sozinho: o prazo parou no último bate (restavam ${pausa ? (pausa.j.resta / 1000).toFixed(1) : "?"} s) e venceu ${jr ? ((jr.hora - tVolta) / 1000).toFixed(1) : "?"} s depois da volta; a pessoa presente ${conta.presMin ?? "?"} s do prazo`);
        SA.parar();
      }

      /* ---------- dormem: as duas pessoas, cada uma contra um bot, travam o celular ao mesmo tempo com o prazo correndo e
         voltam juntas: ninguém viu ninguém sumir, e nenhum dos dois jogos é simulado pelo prazo na volta ---------- */
      if (caso("dormem")) {
        const id = "KO dormem", cod = "KODORM", conta = {};
        let sem = null;
        for (let k = 0; k < 400 && !sem; k++) { const c = LC.contexto({ formato: "pontos", T: 4, semente: "KOz" + k }), js = LC.estrutura(c)[0].jogos; if (js.every(j => (j.src[0].t < 2) !== (j.src[1].t < 2))) sem = "KOz" + k; }
        salaPronta(cod, ["z0", "z1"], 2, "pontos", "it", sem);
        const A = aparelho("z0", { latencia: 20 }), B = aparelho("z1", { latencia: 40 });
        const SA = await A.abrir(cod), SB = await B.abrir(cod);
        await anda(() => SA.sala.meta.estado === "camp", 200_000);
        await anda(() => [SA, SB].every(S => { const mj = S.ver().camp && S.ver().camp.meuJogo; return !!(mj && mj.e === "aberto" && mj.prazo && !mj.prazo.parado); }), 60_000);
        const ids = [SA, SB].map(S => S.ver().camp.meuJogo.id);
        await passa(10_000);
        A.doc.esconde(true); B.doc.esconde(true);
        await passa(180_000);
        A.doc.esconde(false); B.doc.esconde(false); const tVolta = RT.hora;
        await passa(30_000);
        const naVolta = ids.map(i => banco.ler("leiloes/" + cod + "/jogos/" + i));
        ok(naVolta.every(j => j && j.e === "aberto" && !j.parado && j.resta >= LC.PRAZO - 15_000), `${id}: na volta, os jogos: ${JSON.stringify(naVolta)}`);
        await anda(() => ids.every(i => SA.jogos[i] && SA.jogos[i].e === "feito"), 600_000);
        ids.forEach(i => {
          const L = HIST[cod].log[i] || [], jr = L.find(x => x.j && x.j.e === "reservado");
          ok(jr && jr.j.motivo === "prazo" && jr.hora - tVolta >= LC.PRAZO - 15_000, `${id}: ${i} reservado ${jr ? ((jr.hora - tVolta) / 1000).toFixed(1) + " s depois da volta por '" + jr.j.motivo + "'" : "nunca"}`);
        });
        confereHist(cod, SA, id, conta, ids);
        nota(`dormem: a pessoa presente ${conta.presMin ?? "?"} s do prazo no pior jogo`);
        SA.parar(); SB.parar();
      }

      /* ---------- semdono: o DONO some com o jogo dele contra um bot esperando: nos primeiros 5 min só o dono teria o
         "Simular os pendentes"; depois, o outro técnico presente tem (motivo 'pendentes') e o campeonato vai ao fim ---------- */
      if (caso("semdono")) {
        const id = "KO semdono", cod = "KOSEMD", conta = {};
        let sem = null;
        for (let k = 0; k < 400 && !sem; k++) { const c = LC.contexto({ formato: "mata", T: 4, semente: "KOx" + k }), js = LC.estrutura(c)[0].jogos; if (js.every(j => (j.src[0].t < 2) !== (j.src[1].t < 2))) sem = "KOx" + k; }
        salaPronta(cod, ["x0", "x1"], 2, "mata", "it", sem);
        const A = aparelho("x0", { latencia: 20 }), B = aparelho("x1", { latencia: 40 });
        const SA = await A.abrir(cod), SB = await B.abrir(cod);
        await anda(() => SA.sala.meta.estado === "camp", 200_000);
        await passa(3000);
        A.doc.esconde(true); const tSome = RT.hora;    // o dono fecha o app
        const pil = pilotoOnline(SB, () => true);
        await passa(4 * 60_000);
        const c4 = SB.ver().camp, r4 = await espera(SB.simularPendentes());
        const idDono = c4.rodada.jogos.find(g => g.a === 0 || g.b === 0).id;
        ok(c4.pendentes === 1 && !c4.podePendentes && c4.pendLista[0].id === idDono && c4.pendLista[0].t === 0 && !r4.ok && r4.motivo === "dono",
          `${id}: com o dono fora há 4 min, o outro técnico já podia simular os pendentes (${JSON.stringify({ pend: c4.pendentes, pode: c4.podePendentes, r4 })})`);
        await anda(() => SB.ver().camp.podePendentes, 120_000);
        const c5 = SB.ver().camp;
        ok(c5.podePendentes && c5.pendQuem === "outro" && RT.hora - tSome >= 5 * 60_000 - 15_000, `${id}: o "Simular os pendentes" não passou ao outro técnico (${(RT.hora - tSome) / 1000} s; ${JSON.stringify({ pode: c5.podePendentes, quem: c5.pendQuem })})`);
        // o outro técnico toca sempre que o campeonato espera pelo dono (a final também pode ser do dono contra um bot)
        let n = 0;
        while (SB.sala.meta.estado !== "fim" && n < 4) {
          if (!(await anda(() => SB.sala.meta.estado === "fim" || SB.ver().camp.podePendentes, 3600_000))) break;
          if (SB.sala.meta.estado === "fim") break;
          const r = await espera(SB.simularPendentes()); n++;
          ok(r.ok && r.n >= 1, `${id}: o "Simular os pendentes" do outro técnico: ${JSON.stringify(r)}`);
        }
        await anda(() => SB.sala.meta.estado === "fim", 3600_000);
        ok(SB.sala.meta.estado === "fim" && n >= 1, `${id}: o campeonato não acabou sem o dono (${SB.sala.meta.estado}; ${n} toques)`);
        const jr = (HIST[cod].log[idDono] || []).find(x => x.j && x.j.e === "reservado");
        ok(jr && jr.j.motivo === "pendentes" && jr.j.por === 1, `${id}: o jogo do dono reservado por '${jr && jr.j.motivo}' (por ${jr && jr.j.por})`);
        pil.parar();
        // o dono volta e vê tudo gravado
        A.doc.esconde(false);
        await passa(20_000);
        ok(resumo(SA) === resumo(SB) && !SA.alterada && !SB.alterada, `${id}: o dono voltou e viu outro campeonato`);
        confereHist(cod, SB, id, conta);
        nota(`semdono: ${JSON.stringify(conta)} (${n} toques do outro técnico)`);
        SA.parar(); SB.parar();
      }

      /* ---------- pendentes: o "Simular os pendentes" do dono só simula os jogos de quem NÃO está aqui — nunca o do dono
         (ele tem o Simular partida) nem o de quem está presente com o prazo correndo ---------- */
      if (caso("pendentes")) {
        const id = "KO pendentes", cod = "KOPEND", conta = {};
        let sem = null;
        for (let k = 0; k < 400 && !sem; k++) { const c = LC.contexto({ formato: "pontos", T: 4, semente: "KOy" + k }), js = LC.estrutura(c)[0].jogos; if (js.every(j => (j.src[0].t < 2) !== (j.src[1].t < 2))) sem = "KOy" + k; }
        salaPronta(cod, ["y0", "y1"], 2, "pontos", "it", sem);
        const A = aparelho("y0", { latencia: 20 }), B = aparelho("y1", { latencia: 40 });
        const SA = await A.abrir(cod), SB = await B.abrir(cod);
        await anda(() => SA.sala.meta.estado === "camp", 200_000);
        await anda(() => [SA, SB].every(S => { const mj = S.ver().camp && S.ver().camp.meuJogo; return !!(mj && mj.e === "aberto" && mj.prazo && !mj.prazo.parado); }), 60_000);
        const idA = SA.ver().camp.meuJogo.id, idB = SB.ver().camp.meuJogo.id;
        await passa(9000);
        const c1 = SA.ver().camp, r1 = await espera(SA.simularPendentes());
        const j1 = [idA, idB].map(i => banco.ler("leiloes/" + cod + "/jogos/" + i).e);
        ok(c1.pendentes === 0 && !c1.podePendentes && !r1.ok && r1.motivo === "semPendentes" && j1.every(e => e === "aberto"),
          `${id}: com as duas pessoas presentes, o dono ia simular ${c1.pendentes} jogo(s) (${JSON.stringify({ r1, j1 })})`);
        // B some: o jogo dele passa a esperar por quem não está aqui; o do dono, não
        B.doc.esconde(true);
        await anda(() => { const c = SA.ver().camp; return !!(c.podePendentes && c.pendentes === 1); }, 60_000);
        const c2 = SA.ver().camp, r2 = await espera(SA.simularPendentes());
        await passa(2000);
        const jA = banco.ler("leiloes/" + cod + "/jogos/" + idA), jB = banco.ler("leiloes/" + cod + "/jogos/" + idB);
        ok(c2.pendLista.length === 1 && c2.pendLista[0].id === idB && c2.pendLista[0].t === 1 && r2.ok && r2.n === 1 && jB.e === "feito" && jB.motivo === "dono" && jA.e === "aberto",
          `${id}: o dono simulou ${JSON.stringify({ lista: c2.pendLista, r2, jA: jA && jA.e, jB: jB && [jB.e, jB.motivo] })}`);
        B.doc.esconde(false);
        await anda(() => SA.sala.meta.estado === "fim" && SB.sala.meta.estado === "fim", 6 * 3600_000);
        confereHist(cod, SA, id, conta);
        nota(`pendentes: ${JSON.stringify(conta)}`);
        SA.parar(); SB.parar();
      }
      // as regras opcionais não recusaram nenhuma gravação honesta (e recusam as adulterações do campeonato)
      ok(!recusas.length, `as regras opcionais recusariam ${recusas.length} gravações honestas: ${JSON.stringify(recusas.slice(0, 3))}`);
      {
        const raiz = { leiloes: { X: { sala: { meta: { estado: "camp" } }, jogos: {
          a: { e: "aberto", ini: 1000, resta: 120000 }, r: { e: "reservado", trava: 500, ab: [0, 1], motivo: "abertura" },
          f: { e: "feito", trava: 500, ts: 600, res: { placar: [1, 0] } }, p: { e: "aberto", parado: true, resta: 90000 } } } } };
        const TSv = { ".sv": "timestamp" }, recusa = (cam, v, hora) => confereRegras(raiz, ("leiloes/X/" + cam).split("/"), v, hora, "u").length > 0;
        ok(!recusa("jogos/n", { e: "aberto", ini: TSv, resta: 120000 }, 2000) && !recusa("jogos/a", { e: "aberto", parado: true, resta: 90000 }, 31000) &&
          !recusa("jogos/a", { e: "reservado", trava: TSv, motivo: "prazo", ab: [0, 1] }, 121000) && !recusa("jogos/r", { e: "feito", trava: 500, ts: TSv, res: { placar: [2, 0] } }, 9000),
          "as regras opcionais recusaram um passo honesto da máquina do jogo");
        const adult = [
          ["o feito regravado", "jogos/f", { e: "feito", trava: 500, ts: TSv, res: { placar: [0, 3] } }, 9000],
          ["o reservado de volta ao aberto", "jogos/r", { e: "aberto", ini: TSv, resta: 120000 }, 9000],
          ["o prazo antes de vencer", "jogos/a", { e: "reservado", trava: TSv, motivo: "prazo", ab: [0, 1] }, 120999],
          ["a trava inventada", "jogos/n", { e: "reservado", trava: 7, motivo: "abertura", ab: [0, 1] }, 9000],
          ["o feito com outra trava", "jogos/r", { e: "feito", trava: 501, ts: TSv, res: { placar: [2, 0] } }, 9000],
          ["o feito sem reservar", "jogos/a", { e: "feito", trava: 1000, ts: TSv, res: { placar: [2, 0] } }, 9000],
          ["o prazo que volta a crescer", "jogos/p", { e: "aberto", ini: TSv, resta: 100000 }, 9000],
          ["o prazo maior que 2 min", "jogos/n", { e: "aberto", ini: TSv, resta: 120001 }, 9000],
          ["a hora inventada ao abrir", "jogos/n", { e: "aberto", ini: 5, resta: 120000 }, 9000],
          ["o começo do campeonato inventado", "sala/meta/camp", 12345, 9000]
        ];
        adult.forEach(([nome, cam, v, h]) => ok(recusa(cam, v, h), `as regras opcionais deixaram passar ${nome}`));
      }
    } finally {
      nota(`${acontecimentos} acontecimentos; as regras opcionais conferidas em ${gravacoes} gravações (${recusas.length} recusas)`);
    }
  });
}

await testeCamp();
await testeCampSessao();
await testeCampOnline();
await testeProtocolo();
await testeSessao();
await testeRede();
await testeFirebase();
await testeOnline();
const nAsync = ["R", "F", "O"].filter(b => !SO || SO.includes(b)).length;
console.log(`${falhas ? "REPROVOU" : "PASSOU"}: ${resultados.length + nAsync - falhas} de ${resultados.length + nAsync} blocos em ${((performance.now() - t00) / 1000).toFixed(1)} s`);
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
    const sel = "button, a[href], [role=button], input, select, .ut-card, .lei-placar, .lei-meu, .lei-bloco, .next-match, .lei-sala, .lei-caixa, .lei-jogo, .lei-ch-jogo, .md-poster, .lei-cl, .lei-art-l";
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
  // os 8 tamanhos no escuro e no claro (o tema volta ao escuro no fim)
  async function nadaSobreNadaTemas(p, rotulo, extra) {
    await nadaSobreNada(p, rotulo, extra);
    await p.evaluate(() => TM.ui.applyTheme("light"));
    await nadaSobreNada(p, rotulo + "-claro", extra);
    await p.evaluate(() => TM.ui.applyTheme("dark"));
  }
  // o campeonato no tema claro: caixas e jogos claros, texto escuro (o pôster do campeão fica escuro, como o do fim de jogo)
  const temaClaroCamp = p => p.evaluate(() => {
    TM.ui.applyTheme("light");
    const lum = c => { const m = c.match(/\d+(\.\d+)?/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
    const q = s => document.querySelector(s), cs = s => q(s) ? getComputedStyle(q(s)) : null;
    const out = { caixa: cs(".lei-rodada") && lum(cs(".lei-rodada").backgroundColor), jogo: cs(".lei-jogo") && lum(cs(".lei-jogo").backgroundColor),
      texto: cs(".lei-rod-n") && lum(cs(".lei-rod-n").color), seu: cs(".lei-seujogo") ? lum(cs(".lei-seujogo").backgroundColor) : null };
    TM.ui.applyTheme("dark");
    return out;
  });
  // os extras medidos no campeonato: a tabela não rola de lado dentro da caixa e os escudos são os desenhados
  const extraCamp = async p => p.evaluate(() => {
    const r = document.querySelector(".lei-tab-rola");
    return { tabelaRola: r ? r.scrollWidth > r.clientWidth + 1 : false, escudosReais: document.querySelectorAll(".lei-corpo-camp img").length };
  });
  // o campeonato pela tela: toca em Simular partida sempre que dá e vê cada jogo no 2D (Pular, Ver resultado, a prorrogação
  // e os pênaltis gravados), conferindo o que a tela mostra contra o resultado GRAVADO; para no fim ou quando ate(V) diz
  async function campPelaTela(p, ate0, limiteMs = 300000) {
    const vis = { simular: 0, jogos: 0, pror: 0, ouro: 0, pen: 0, ruins: [], fim: false };
    const t0 = Date.now();
    while (Date.now() - t0 < limiteMs) {
      const r = await p.evaluate(ate0 => { const S = TM.leilaoSessao.atual(), V = S && S.ver(); return { rota: TM.ui.current(), estado: V && V.estado, ate: !!(ate0 && V && V.camp && new Function("V", "return " + ate0)(V)) }; }, ate0 || null);
      if (r.estado === "fim" && r.rota === "leilao-camp") { vis.fim = true; break; }
      if (r.ate && r.rota === "leilao-camp") break;
      if (r.rota === "leilao-camp") {
        const clicou = await p.evaluate(() => { const b = document.querySelector(".lei-simular"); if (b && !b.disabled) { b.click(); return true; } return false; });
        if (clicou) { vis.simular++; await ate(p, () => TM.ui.current() !== "leilao-camp" || !document.querySelector(".lei-simular[aria-busy]"), null, 15000); }
        await espera(clicou ? 250 : 100);
        continue;
      }
      if (r.rota !== "leilao-jogo") { vis.ruins.push("rota " + r.rota); await p.evaluate(() => TM.ui.go("leilao-camp")); continue; }
      // no 2D: o gravado, sem pausa; Pular mostra o placar dos 90' gravado; nenhum sorteio novo pelo matchview
      vis.jogos++;
      await espera(250);
      const g = await p.evaluate(() => {
        const id = TM.leilaoTela.estado().jogo, J = TM.leilaoSessao.atual().partida(id);
        window.__sims2d = 0;
        return { id, res: J && { score: J.res.score, pror: J.res.pror ? J.res.pror.score : null, ouro: J.res.pror && J.res.pror.ouro != null, pen: J.res.pen ? { score: J.res.pen.score, n: J.res.pen.kicks.length } : null },
          pausa: [...document.querySelectorAll(".screen.is-active button")].some(b => /Pausar/.test(b.textContent)), crest: document.querySelectorAll(".bc-crest.utx-escudo").length };
      });
      // animando (a velocidade normal): sem o botão de pausa, e o Pular vai adiante; instantâneo: o placar dos 90' já à mostra
      const f90 = await p.evaluate(() => ({ animando: [...document.querySelectorAll(".screen.is-active .actions button")].some(x => /Pular/.test(x.textContent)),
        placar: (document.querySelector(".live-score") || {}).textContent, overlay: !!document.querySelector(".pause-overlay"), campo2d: [...document.querySelectorAll(".screen.is-active button")].some(x => /Campo 2D/.test(x.textContent)) }));
      // nos 2 primeiros jogos animados, o Campo 2D ligado antes do Pular: os chutes deixam a bola sem condutor e a pessoa sai
      // do 2D com ele ligado (o laço do Campo 2D tem de parar sem erro de página na aba Campeonato)
      if (f90.animando && (vis.campo2d || 0) < 2) {
        const ligou = await p.evaluate(() => { const b = [...document.querySelectorAll(".screen.is-active button")].find(x => /Campo 2D/.test(x.textContent)); if (b) b.click(); return !!b; });
        if (ligou) { vis.campo2d = (vis.campo2d || 0) + 1; await espera(1500); }
      }
      if (f90.animando) { vis.animados = (vis.animados || 0) + 1; await p.evaluate(() => { const b = [...document.querySelectorAll(".screen.is-active .actions button")].find(x => /Pular/.test(x.textContent)); if (b) b.click(); }); await espera(120); }
      else vis.placares = (vis.placares || 0) + 1;
      f90.sims = await p.evaluate(() => window.__sims2d);
      if (!g.res || g.pausa || g.crest !== 2 || f90.overlay || f90.sims || !f90.campo2d || (!f90.animando && f90.placar !== g.res.score[0] + " - " + g.res.score[1])) vis.ruins.push({ jogo: g.id, g, f90 });
      // Ver resultado → (a prorrogação → os pênaltis) → o Campeonato
      for (let k = 0; k < 6; k++) {
        const rota = await p.evaluate(() => TM.ui.current());
        if (rota === "leilao-camp") break;
        if (rota === "prorrogacao") {
          vis.pror++;
          const pr = await p.evaluate(() => ({ t: document.querySelector(".pror-t").textContent, num: document.querySelector(".pror-num").textContent, ouro: !!document.querySelector(".pror-ouro"), s: document.querySelector(".pror-s").textContent }));
          if (g.res.ouro) vis.ouro++;
          if (!/GOL DE OURO/.test(pr.t) || !/1º gol acaba/.test(pr.s) || !g.res.pror || pr.num !== g.res.pror[0] + " × " + g.res.pror[1] || pr.ouro !== g.res.ouro) vis.ruins.push({ jogo: g.id, pror: pr, res: g.res });
        }
        if (rota === "pen-shootout") {
          vis.pen++;
          await ate(p, () => [...document.querySelectorAll(".screen.is-active button")].some(b => /^Continuar$/.test(b.textContent.trim())), null, 30000);
          const pk = await p.evaluate(() => ({ n: document.querySelectorAll(".pk-kick").length, st: document.querySelector(".pk-status").textContent, crest: document.querySelectorAll(".pk-crest.utx-escudo").length }));
          if (!g.res.pen || pk.n !== g.res.pen.n || pk.st.indexOf(g.res.pen.score[0] + "–" + g.res.pen.score[1]) < 0 || pk.crest !== 2) vis.ruins.push({ jogo: g.id, pen: pk, res: g.res });
        }
        await p.evaluate(() => { const b = [...document.querySelectorAll(".screen.is-active button")].find(x => /Ver resultado|^Continuar$|Ir para os pênaltis/.test(x.textContent.trim())); if (b) b.click(); });
        await espera(250);
      }
    }
    return vis;
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
    confere("T2 a região ao vivo no HTML inicial (#lei-vivo, role=status, aria-live=polite) e os 5 arquivos do leilão no index.html",
      /<div id="lei-vivo"[^>]*role="status"[^>]*aria-live="polite"/.test(html) && ["leilao.js", "leilao-camp.js", "leilao-rede.js", "leilao-sessao.js", "leilao-tela.js"].every(f => html.includes("js/" + f + "?v=")));
    await p.evaluate(() => [...document.querySelectorAll(".vit-mais-b")].find(b => b.textContent.trim() === "Leilão").click());
    await espera(400);
    const entrada = await p.evaluate(() => ({ rota: TM.ui.current(), txt: document.querySelector(".screen.is-active").innerText.replace(/\s+/g, " "),
      off: [...document.querySelectorAll(".lei-online button")].map(b => b.disabled) }));
    // (aqui o SDK do Firebase é um vazio: sem a conta online, a Entrada oferece só o Treino e diz por quê)
    confere("T2 o atalho abre a Entrada: Treinar contra bots e, sem conexão com o servidor, o online com Criar sala e Entrar com código desligados", entrada.rota === "leilao" && /Treinar contra bots/.test(entrada.txt) && /Sem conexão com o servidor/i.test(entrada.txt) && entrada.off.length === 2 && entrada.off.every(Boolean), entrada);
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
    // o Formato: 3 cartões, o Mata-mata de padrão, "N rodadas com 4 técnicos · ~X a Y min"; o toque troca e o resumo diz
    const fmt = await p.evaluate(async () => {
      const cards = () => [...document.querySelectorAll(".lei-criar .lei-fmt")];
      const ler = () => ({ on: cards().filter(b => b.getAttribute("aria-pressed") === "true").map(b => b.dataset.fmt), linhas: cards().map(b => b.querySelector(".lei-fmt-s").textContent), resumo: document.querySelector(".lei-criar-resumo").textContent });
      const a = ler();
      const out = { a, passos: [] };
      for (const f of ["pontos", "misto", "mata"]) { document.querySelector('.lei-criar .lei-fmt[data-fmt="' + f + '"]').click(); await new Promise(r => setTimeout(r, 60)); out.passos.push(ler()); }
      return out;
    });
    const linhaOk = (l, n) => new RegExp("^" + n + " rodadas com 4 técnicos · ~\\d+ a \\d+ min$").test(l);
    confere("T2 o Formato na Criar: Mata-mata (padrão), Pontos corridos e Pontos + mata-mata com 'N rodadas com 4 técnicos · ~X a Y min' (2, 6 e 4); o toque troca e o resumo diz o formato e a duração do campeonato",
      fmt.a.on.join() === "mata" && linhaOk(fmt.a.linhas[0], 2) && linhaOk(fmt.a.linhas[1], 6) && linhaOk(fmt.a.linhas[2], 4) && /Mata-mata · leilão de cerca de \d+ a \d+ min e campeonato de \d+ a \d+ min/.test(fmt.a.resumo)
      && fmt.passos[0].on.join() === "pontos" && /Pontos corridos/.test(fmt.passos[0].resumo) && fmt.passos[1].on.join() === "misto" && /Pontos \+ mata-mata/.test(fmt.passos[1].resumo) && fmt.passos[2].on.join() === "mata", fmt);
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
    // quantas amostras saem depende do caminho sorteado (o Passar e a sala do treino; a maior parte cai com o retorno do toque
    // na linha de cima): de 6 a 90 nas duas versões. O que vale é nenhuma errada e um motivo de goleiro/posição/máximo/completo
    const n7 = Object.values(amostras.motivos).reduce((s, x) => s + x, 0);
    confere("T7 o leilão vai até o fim pela tela; sempre que o +1 apaga, a linha de cima diz o motivo (com o de goleiro/posição/máximo/completo entre eles)",
      V.estado !== "leilao" && n7 >= 3 && !amostras.ruins.length && Object.keys(amostras.motivos).some(k => /goleiro|posicao|max|completo/.test(k)), { estado: V.estado, motivos: amostras.motivos, ruins: amostras.ruins.slice(0, 5) });
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
    // Pronto → o campeonato: quem confirmou vai sozinho à aba Campeonato
    await p.evaluate(() => TM.leilaoSessao.acelerar(1));
    await clica(p, "^Pronto$");
    await ate(p, () => TM.leilaoSessao.atual().ver().estado === "camp", null, 15000);
    const foiCamp = await ate(p, () => TM.ui.current() === "leilao-camp" && !!document.querySelector(".lei-rodada"), null, 10000);
    await espera(300);
    const camp = await p.evaluate(() => { const V = TM.leilaoSessao.atual().ver(); return { rota: TM.ui.current(), estado: V.estado, formato: V.camp && V.camp.formato, txt: document.querySelector(".screen.is-active").innerText.replace(/\s+/g, " "),
      feitas: [...document.querySelectorAll(".lei-aba.feita")].map(b => b.dataset.rota), seu: !!document.querySelector(".lei-seujogo"), chave: !!document.querySelector(".lei-chave"), tabela: !!document.querySelector(".lei-tabela"),
      jogos: document.querySelectorAll(".lei-rodada .lei-jogo").length }; });
    confere("T8 'Pronto' leva ao campeonato sozinho: a aba Campeonato com o Mata-mata (Seu jogo, a rodada com 2 jogos e a chave, sem tabela), sem 'em breve'; Leilão e Escalação com o check",
      foiCamp && camp.estado === "camp" && camp.formato === "mata" && camp.seu && camp.chave && !camp.tabela && camp.jogos === 2 && !/em breve/i.test(camp.txt) && /Mata-mata/.test(camp.txt) && camp.feitas.join() === "leilao-lote,leilao-escalacao", camp);
    await print(p, "8-campeonato");

    /* T11 o Campeonato no treino: Seu jogo com o prazo, a Escalação que vale no próximo jogo, o Simular partida (grava e só
       então mostra) e o Ver o jogo no 2D sem pausa */
    await ate(p, () => { const V = TM.leilaoSessao.atual().ver(); return V.camp && V.camp.meuJogo && V.camp.meuJogo.e === "aberto" && V.camp.meuJogo.podeSimular; }, null, 15000);
    await espera(300);
    const pz1 = await p.evaluate(() => TM.leilaoTela.estado().prazo);
    await espera(1300);
    const seu = await p.evaluate(() => ({ prazo: TM.leilaoTela.estado().prazo, escudos: document.querySelectorAll(".lei-seujogo .utx-escudo").length, simular: !!document.querySelector(".lei-simular:not([disabled])"),
      txt: document.querySelector(".lei-seujogo").innerText.replace(/\s+/g, " ") }));
    confere("T11 Seu jogo: os dois escudos desenhados, 'Simulado sozinho em M:SS' andando pelo relógio da sala e o Simular partida",
      /^Simulado sozinho em \d:\d\d/.test(pz1 || "") && /^Simulado sozinho em \d:\d\d/.test(seu.prazo || "") && seu.prazo !== pz1 && seu.escudos === 2 && seu.simular && /Seu jogo · Semifinal/i.test(seu.txt), { pz1, seu });
    await nadaSobreNadaTemas(p, "camp", extraCamp);
    const claroCamp = await temaClaroCamp(p);
    confere("T11 o Campeonato no tema claro: as caixas e os jogos claros, o texto escuro", claroCamp.caixa > 0.9 && claroCamp.jogo > 0.9 && claroCamp.seu > 0.9 && claroCamp.texto < 0.3, claroCamp);
    // a Escalação continua aberta no campeonato e diz que vale a partir do próximo jogo
    await p.click('.lei-aba[data-rota="leilao-escalacao"]');
    await espera(300);
    const escCamp = await p.evaluate(() => ({ txt: document.querySelector(".lei-esc-camp").innerText, vagas: document.querySelectorAll('.lei-pitch-esc .lei-vaga[role="button"]').length }));
    confere("T11 a Escalação no campeonato: as 11 vagas tocáveis e 'vale a partir do seu próximo jogo que ainda não começou'", escCamp.vagas === 11 && /próximo jogo que ainda não começou/.test(escCamp.txt), escCamp);
    await p.click('.lei-aba[data-rota="leilao-camp"]');
    await ate(p, () => !!document.querySelector(".lei-simular"), null, 10000);
    // o Simular partida: só abre o 2D com o jogo JÁ gravado (feito), e o 2D toca o gravado sem pausa
    await p.evaluate(() => {
      const o = TM.engine.simulate; window.__sims2d = 0;
      // conta só os sorteios feitos pelo 2D (o resimRest da pausa): a conferência da sessão também simula, por outro caminho
      TM.engine.simulate = function () { if (/matchview\.js/.test(new Error().stack || "")) window.__sims2d++; return o.apply(this, arguments); };
      window.__feitoAoAbrir = null;
      const go = TM.ui.go;
      TM.ui.go = function (r, prm) { if (r === "leilao-jogo") { const S = TM.leilaoSessao.atual(), V = S.ver(); let g = null; V.camp.rodadas.forEach(R => R.jogos.forEach(x => { if (x.id === prm.id) g = x; })); window.__feitoAoAbrir = g ? g.e : "?"; } return go.apply(this, arguments); };
    });
    const v1 = await campPelaTela(p, "V.camp.rodadas[0].feita", 60000);
    const aoAbrir = await p.evaluate(() => window.__feitoAoAbrir);
    confere("T11 'Simular partida' grava antes de mostrar: o 2D abre com o jogo já feito, anima sem o botão de pausa (pauseSide null) e não sorteia nada (e o Campo 2D ligado; ao sair, nenhum erro de página: ver o último item)",
      v1.simular >= 1 && v1.jogos >= 1 && v1.animados >= 1 && v1.campo2d >= 1 && aoAbrir === "feito" && !v1.ruins.length, { v1, aoAbrir });
    // o estado de cada jogo na rodada: Simulado com o placar e o Ver o jogo
    const linhas = await p.evaluate(() => [...document.querySelectorAll(".lei-rodada .lei-jogo")].map(li => ({ e: li.dataset.e, est: li.querySelector(".lei-jg-est").textContent, pl: li.querySelector(".lei-jg-pl").textContent, ver: !!li.querySelector(".lei-jg-ver") })));
    confere("T11 os jogos da rodada com o estado ('Simulado' com o placar e o Ver o jogo; 'Esperando' sem placar)",
      linhas.length > 0 && linhas.every(l => (l.e === "feito" && /^Simulado/.test(l.est) && /^\d+ × \d+$/.test(l.pl) && l.ver) || (l.e !== "feito" && /Esperando|Simulando|A definir/.test(l.est) && l.pl === "×" && !l.ver)), linhas);
    // ‹ › pela rodada mantém o foco no botão
    const nav1 = await p.evaluate(async () => {
      const rod = () => document.querySelector(".lei-rodada").dataset.rodada, a = rod();
      const prox = document.querySelector('.lei-rod-bt[data-foco="rod-prox"]'), ant = document.querySelector('.lei-rod-bt[data-foco="rod-ant"]');
      const alvo = !prox.disabled ? prox : ant; alvo.focus(); alvo.click();
      await new Promise(r => setTimeout(r, 120));
      const b = rod(), foco = document.activeElement && document.activeElement.dataset.foco;
      document.activeElement.click();
      await new Promise(r => setTimeout(r, 120));
      return { a, b, foco, c: rod(), vista: TM.leilaoTela.estado().rodadaVista };
    });
    confere("T11 ‹ › mostra as outras rodadas e o foco fica no botão", nav1.a !== nav1.b && /^rod-/.test(nav1.foco || "") && nav1.vista != null, nav1);
    await p.evaluate(() => { const b = document.querySelector('[data-foco="rod-vez"]'); if (b) b.click(); });

    /* T12 o resto do mata-mata até o campeão pela tela, e o fim (o 2D instantâneo daqui em diante: o placar dos 90' à mostra) */
    await p.evaluate(() => { TM.storage.saveSettings(Object.assign({}, TM.storage.settings(), { matchSpeed: "instantaneo" })); TM.leilaoSessao.acelerar(20); });
    const v2 = await campPelaTela(p, null, 120000);
    await espera(400);
    const fimV = await p.evaluate(() => { const V = TM.leilaoSessao.atual().ver(), C = V.camp; return { estado: V.estado, campeao: C.campeao, classificacao: C.classificacao, art: C.artilharia[0] ? C.artilharia[0].nome : null, mt: C.melhorTime,
      nomes: V.tecnicos.map(t => t.clube.nome), eu: V.eu, rota: TM.ui.current(),
      poster: document.querySelector(".lei-campeao") ? document.querySelector(".lei-campeao").innerText.replace(/\s+/g, " ") : "", escPoster: document.querySelectorAll(".lei-campeao .utx-escudo").length,
      classe: [...document.querySelectorAll(".lei-class .lei-cl-n")].map(e => e.textContent), dest: [...document.querySelectorAll(".lei-dest .lei-dest-n")].map(e => e.textContent),
      bts: [...document.querySelectorAll(".lei-fim-acoes button")].map(b => b.textContent.trim()) }; });
    confere("T12 o mata-mata até o campeão pela tela (cada jogo visto no 2D conferido contra o gravado: o placar dos 90', a prorrogação e os pênaltis)", v2.fim && fimV.estado === "fim" && !v2.ruins.length, { v2, estado: fimV.estado });
    confere("T12 o fim: o campeão no pôster com o escudo desenhado, a classificação final na ordem, o artilheiro, o melhor time pela soma das notas, Voltar e Criar outra sala",
      fimV.rota === "leilao-camp" && fimV.escPoster === 1 && fimV.poster.indexOf(fimV.nomes[fimV.campeao]) >= 0 && /Campeão/i.test(fimV.poster)
      && fimV.classe.join("|") === fimV.classificacao.map(t => fimV.nomes[t]).join("|") && fimV.dest[0] === (fimV.art || "Ninguém marcou") && fimV.dest[1] === fimV.nomes[fimV.mt.t]
      && fimV.bts.join("|") === "Voltar|Criar outra sala" && (fimV.campeao === fimV.eu ? /Você é o campeão/i.test(fimV.poster) : /Seu lugar: \d+º/i.test(fimV.poster)), fimV);
    const anCamp = await p.evaluate(() => TM.leilaoTela.anuncios());
    confere("T12 a região ao vivo falou a rodada que abriu e o campeão", anCamp.some(a => /começou$/.test(a) && /Final|Semifinal|Rodada/.test(a)) && anCamp.some(a => /^O campeonato acabou: campeão .+/.test(a)), anCamp.slice(-8));
    await nadaSobreNadaTemas(p, "fim", extraCamp);
    await print(p, "12-fim");
    // Criar outra sala abre a Criar (o treino); volta à sala para o Sair do T9
    await clica(p, "^Criar outra sala$");
    await espera(300);
    const outra = await p.evaluate(() => TM.ui.current());
    await p.evaluate(() => TM.ui.go("leilao-camp"));
    await espera(300);
    confere("T12 'Criar outra sala' abre a Criar sala", outra === "leilao-criar", outra);

    /* T9 Sair da sala (com confirmação) apaga o treino deste aparelho */
    await p.click(".lei-sb.sair");
    await espera(250);
    await p.evaluate(() => { const b = [...document.querySelectorAll(".sheet-overlay .sheet-item")].find(x => x.textContent.trim() === "Sair da sala"); if (b) b.click(); });
    await ate(p, () => TM.ui.current() === "leilao", null, 10000);
    const saiu = await p.evaluate(() => ({ atual: !!TM.leilaoSessao.atual(), salas: TM.leilaoSessao.salas().length }));
    confere("T9 'Sair da sala' pede confirmação, volta à Entrada e apaga o treino", !saiu.atual && saiu.salas === 0, saiu);

    /* T10 o convite pelo link (?leilao=CÓDIGO): a Entrada com o código, guardado uma vez por carga da página */
    {
      const cx = await nav.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
      await cx.route(/^https:\/\/www\.gstatic\.com\//, r => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
      const p = await cx.newPage();
      p.on("pageerror", e => errosPagina.push(String(e).slice(0, 300)));
      await p.goto(srv.url + "index.html?leilao=" + encodeURIComponent("https://x/?leilao=ab2cd3"), { waitUntil: "load" });
      await ate(p, () => window.TM && TM.ui && TM.ui.current && TM.ui.current() === "leilao", null, 30000);
      const r1 = await p.evaluate(() => ({ rota: TM.ui.current(), convite: TM.leilaoTela.convite() }));
      // voltar à Entrada não guarda de novo; usar o convite o tira
      const r2 = await p.evaluate(() => { TM.leilaoTela.convite(true); TM.ui.go("modes"); TM.ui.go("leilao", { codigo: "ZZZZZZ", auto: true }); return TM.leilaoTela.convite(); });
      confere("T10 o link ?leilao=CÓDIGO abre a Entrada do leilão com o convite (o link colado limpo, maiúsculas), uma vez por carga da página",
        r1.rota === "leilao" && r1.convite === "AB2CD3" && r2 === null, { r1, r2 });
      await cx.close();
    }

    /* T13 os outros formatos até o campeão pela tela: Pontos corridos com 8 (a tabela com 8), Pontos + mata-mata com 8 (a
       tabela e a chave da fase final) e o Mata-mata com 6 (a chave com as folgas); nada sobre nada nos 8 tamanhos, no
       escuro e no claro. O leilão desses passa em tudo pela sessão (a tela do leilão já foi conferida no T3–T7). */
    async function treinoAteCamp(T, formato) {
      await p.evaluate(() => { TM.leilaoSessao.acelerar(40); TM.ui.go("leilao-criar"); });
      await espera(400);
      await p.evaluate(T => { const menos = document.querySelector('[aria-label="Menos um técnico"]'), mais = document.querySelector('[aria-label="Mais um técnico"]');
        for (let i = 0; i < 10; i++) menos.click(); for (let i = 2; i < T; i++) mais.click(); }, T);
      await p.click(`.lei-criar .lei-fmt[data-fmt="${formato}"]`);
      await clica(p, "Começar o treino");
      await ate(p, () => TM.ui.current() === "leilao-lote" && !!TM.leilaoSessao.atual(), null, 30000);
      // (no fim do leilão o relógio volta ao normal na hora: com ele a ×40, os 60 s da escalação passariam antes de a tela ir até ela)
      for (let i = 0; i < 4000; i++) {
        const e = await p.evaluate(() => { const S = TM.leilaoSessao.atual(), V = S.ver(); if (V.estado === "leilao" && V.botoes && V.botoes.passar.pode) S.passar(); if (V.estado !== "leilao") TM.leilaoSessao.acelerar(1); return V.estado; });
        if (e !== "leilao") break;
        await espera(40);
      }
      await ate(p, () => TM.ui.current() === "leilao-escalacao" && !!document.querySelector(".lei-esc-pronto"), null, 20000);
      await p.evaluate(() => TM.leilaoSessao.acelerar(20));
      await clica(p, "^Pronto$");
      await ate(p, () => TM.ui.current() === "leilao-camp" && !!document.querySelector(".lei-rodada"), null, 20000);
      await espera(300);
      const V = await ver(p);
      return { T: V.T, formato: V.camp && V.camp.formato };
    }
    const fimDe = () => p.evaluate(() => { const V = TM.leilaoSessao.atual().ver(), C = V.camp; return { estado: V.estado, n: document.querySelectorAll(".lei-class .lei-cl").length,
      classe: [...document.querySelectorAll(".lei-class .lei-cl-n")].map(e => e.textContent).join("|"), esperado: C.classificacao.map(t => V.tecnicos[t].clube.nome).join("|"),
      x: [...document.querySelectorAll(".lei-class .lei-cl-x")].map(e => e.textContent), poster: !!document.querySelector(".lei-campeao .utx-escudo") }; });

    // Pontos corridos com 8
    const tp = await treinoAteCamp(8, "pontos");
    const vp1 = await campPelaTela(p, "V.camp.atual >= 3", 120000);
    const tab = await p.evaluate(() => { const C = TM.leilaoSessao.atual().ver().camp; return { linhas: document.querySelectorAll(".lei-tabela tbody tr").length,
      pts: [...document.querySelectorAll(".lei-tabela tbody tr td.c7")].map(td => +td.textContent).join(), esperado: C.tabela.map(r => r.pts).join(), eu: document.querySelectorAll(".lei-tabela tbody tr.eu").length,
      chave: !!document.querySelector(".lei-chave"), sub: document.querySelector(".lei-camp-sub").textContent }; });
    confere("T13 Pontos corridos com 8: a tabela com os 8 na ordem da sessão, a minha linha marcada, sem chave; 'Rodada N de 14 · 1º turno'",
      tp.T === 8 && tp.formato === "pontos" && tab.linhas === 8 && tab.pts === tab.esperado && tab.eu === 1 && !tab.chave && /^Rodada \d+ de 14 · [12]º turno$/.test(tab.sub) && !vp1.ruins.length, { tp, tab, ruins: vp1.ruins.slice(0, 3) });
    await p.evaluate(() => TM.leilaoSessao.acelerar(1));
    await nadaSobreNadaTemas(p, "camp-pontos8", extraCamp);
    await p.evaluate(() => TM.leilaoSessao.acelerar(20));
    const vp2 = await campPelaTela(p, null, 300000);
    const fp = await fimDe();
    confere("T13 Pontos corridos até o campeão pela tela: a classificação final com os 8 (na ordem da tabela) e os pontos de cada um",
      vp2.fim && !vp2.ruins.length && fp.estado === "fim" && fp.n === 8 && fp.classe === fp.esperado && fp.x.every(t => /^\d+ pontos?$/.test(t)) && fp.poster, { fp, ruins: vp2.ruins.slice(0, 3), jogos: vp1.jogos + vp2.jogos });
    await nadaSobreNadaTemas(p, "fim-pontos8", extraCamp);

    // Pontos + mata-mata com 8: a fase de pontos, depois a chave com os 4 classificados
    const tm = await treinoAteCamp(8, "misto");
    const vm1 = await campPelaTela(p, "V.camp.ligaFeita", 240000);
    const mx = await p.evaluate(() => { const V = TM.leilaoSessao.atual().ver(), C = V.camp; return {
      classif: document.querySelectorAll(".lei-tabela tbody tr.classif").length, semis: [...document.querySelectorAll(".lei-ch-col")].map(c => [...c.querySelectorAll(".lei-ch-n")].map(e => e.textContent)),
      esperado: [[0, 3], [1, 2]].map(pr => pr.map(k => V.tecnicos[C.tabela[k].t].clube.nome)), nota: (document.querySelector(".lei-tab-nota") || {}).textContent }; });
    confere("T13 Pontos + mata-mata com 8: os 4 primeiros marcados na tabela e a chave com 1º × 4º e 2º × 3º, e a Final",
      tm.formato === "misto" && mx.classif === 4 && mx.semis.length === 2 && mx.semis[0].join("|") === mx.esperado.map(x => x.join("|")).join("|") && mx.semis[1].length === 2 && /4 primeiros/.test(mx.nota || "") && !vm1.ruins.length, { mx, ruins: vm1.ruins.slice(0, 3) });
    await p.evaluate(() => TM.leilaoSessao.acelerar(1));
    await nadaSobreNadaTemas(p, "camp-misto8", extraCamp);
    await p.evaluate(() => TM.leilaoSessao.acelerar(20));
    const vm2 = await campPelaTela(p, null, 120000);
    const fm = await fimDe();
    confere("T13 Pontos + mata-mata até o campeão pela tela: a classificação final com os 8 (Campeão, Vice, Semifinal e a fase de pontos)",
      vm2.fim && !vm2.ruins.length && fm.n === 8 && fm.classe === fm.esperado && fm.x[0] === "Campeão" && fm.x[1] === "Vice" && fm.x.slice(2, 4).every(t => t === "Semifinal") && fm.x.slice(4).every(t => /^Fase de pontos · [5-8]º$/.test(t)), { fm, ruins: vm2.ruins.slice(0, 3) });

    // Mata-mata com 6: 2 folgas na 1ª rodada, espalhadas pela chave
    const t6 = await treinoAteCamp(6, "mata");
    await p.evaluate(() => TM.leilaoSessao.acelerar(1));
    const ch6 = await p.evaluate(() => { const C = TM.leilaoSessao.atual().ver().camp; return { col: [...document.querySelectorAll(".lei-ch-col")].map(c => ({ tit: c.querySelector(".lei-ch-tit").textContent, jogos: c.querySelectorAll(".lei-ch-jogo:not(.folga)").length, folgas: c.querySelectorAll(".lei-ch-jogo.folga").length })),
      folgas: C.rodadas[0].folgas.length, rotulos: [...document.querySelectorAll(".lei-ch-g.folga")].map(e => e.textContent) }; });
    confere("T13 Mata-mata com 6: a chave com as Quartas (2 jogos e 2 folgas), a Semifinal e a Final",
      t6.formato === "mata" && ch6.folgas === 2 && ch6.col.length === 3 && ch6.col[0].jogos === 2 && ch6.col[0].folgas === 2 && ch6.col[1].tit === "Semifinal" && ch6.col[2].tit === "Final" && ch6.rotulos.every(t => t === "folga"), ch6);
    await nadaSobreNadaTemas(p, "camp-mata6", extraCamp);
    await p.evaluate(() => TM.leilaoSessao.acelerar(20));
    const v6 = await campPelaTela(p, null, 120000);
    const f6 = await fimDe();
    confere("T13 Mata-mata com 6 até o campeão pela tela: a classificação final com os 6 (Campeão, Vice, Semifinal, Quartas de final)",
      v6.fim && !v6.ruins.length && f6.n === 6 && f6.classe === f6.esperado && f6.x[0] === "Campeão" && f6.x[1] === "Vice" && f6.x.every(t => /^(Campeão|Vice|Semifinal|Quartas de final)$/.test(t)), { f6, ruins: v6.ruins.slice(0, 3) });
    const vistos = [vp1, vp2, vm1, vm2, v6];
    const soma = k => vistos.reduce((s2, v) => s2 + (v[k] || 0), 0);
    confere(`T13 os jogos vistos no 2D pela tela (${soma("jogos")}, ${soma("placares")} com o placar dos 90' conferido; ${soma("pror")} prorrogações, ${soma("ouro")} no gol de ouro, ${soma("pen")} pênaltis) batem com o gravado`,
      soma("jogos") >= 20 && soma("placares") >= 20 && !vistos.some(v => v.ruins.length), { jogos: soma("jogos"), pror: soma("pror"), pen: soma("pen") });
    const ruinsCamp = nadaSobre.filter(x => /^(camp|fim)/.test(x.tela) && (x.sobre.length || x.encostam.length || x.saem.length || x.fora.length || x.rolaLado || x.tabelaRola || x.escudosReais));
    confere(`T13 nada sobre nada no Campeonato e no fim (${nadaSobre.filter(x => /^(camp|fim)/.test(x.tela)).length} telas: mata 4, pontos 8, misto 8, mata 6 e os fins, nos 8 tamanhos, escuro e claro): nem encostado, nem texto fora do botão, a tabela sem rolar de lado, só escudos desenhados`,
      !ruinsCamp.length, ruinsCamp.slice(0, 6));
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
