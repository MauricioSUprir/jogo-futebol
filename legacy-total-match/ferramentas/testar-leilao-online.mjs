#!/usr/bin/env node
/* Teste de navegador do Modo Leilão ONLINE (PLANO-LEILAO.md §4.3): várias páginas do Chromium (cada uma um aparelho, com o
   armazenamento separado) contra o banco falso (ferramentas/lib/banco-falso.mjs) no lugar do Firebase — o SDK do gstatic
   é trocado pelo SDK compat falso e o mesmo js/net.js do TM roda por cima dele (login anônimo, nome, número). Nenhuma
   página fala com o Firebase de verdade: os endereços dele são bloqueados e contados (G1 reprova se alguém tentar).
   O site é servido como no GitHub Pages (o TM na raiz; o leilão não usa o /golaco/): esta pasta pelo servidor do
   golaco/tools/lib/navegador.mjs, ou o endereço dado (ex.: o site montado com o golaco em /golaco/).
   O relógio é ACELERADO (relogioAcelerado do banco falso: o servidor e as páginas na mesma conta; Date, performance.now e
   os timers da página andam --fator vezes mais rápido; cada página pode ter o seu desvio e um pulo no meio).
   O servidor falso confere CADA gravação do vivo (como o bloco O do testar-leilao.mjs): nenhum lote fecha antes do fim
   pela hora do servidor; e nenhum lance entra mais de 1,5 s depois do fim (a tolerância é o caminho da mensagem com o
   relógio acelerado: 1,5 s de jogo são ~0,25 s de verdade; um relógio de aparelho errado em segundos aparece aqui).
   As pessoas jogam por um PILOTO na página (window.__lt): decide como um robô com o perfil do seu índice
   (TM.leilao.robo) e age pela TELA (os botões de verdade: +1, +5, +10, Tudo de dois toques, Outro valor + Dar lance,
   Passar) ou pela API da sessão (S.lance, S.passar).
   Casos (--so telas,dois,quatro,oito; sem --so, todos):
     telas   (T1–T8) o que a revisão do PR 2 achou nas telas, com nomes de 16 letras: o nome inteiro nos pedidos e nos
             participantes nos 8 tamanhos, o foco pelo teclado depois de Aceitar, o Salvar do clube apagado sem mudança,
             "Atualizando a sala…" na barra, o "lidera" do placar à vista e a sala congelada "parada" na Entrada e nas
             Minhas salas
     dois    (D1–D14) a sala pela tela: criar sala, o código escondido com o olho e o QR, Copiar convite, Compartilhar só
             com navigator.share; o pedido pelo link ?leilao= e aceitar; o pedido pelo código e recusar (não pede de
             novo); as recusas na tela (código errado, sala cheia, edição, regras diferentes); Pronto e Começar; nada sobre
             nada no Saguão (dono e convidado) e no Leilão em 360×740, 844×390 e 1280×800, no escuro e no claro; o leilão
             inteiro pelos botões nas duas páginas; dois lances no mesmo instante (um vence, o outro vê "Alguém chegou
             antes"); o ack perdido ("Conferindo…" e o resultado certo); o lance velho guardado (recusado); recarregar no
             meio (pelo ?leilao= e pelas Minhas salas, depois do deploy: versaoTM diferente, quem é da sala volta); o fim
             igual nas duas e no servidor; a escalação pela tela e o campeonato "em breve"
     quatro  (Q1–Q6) 4 páginas + 2 bots: os relógios +5 s e −5 s, o pulo de +60 s depois da calibração, um técnico que
             some (a página escondida: ausente, passa sozinho, não gasta, volta), passar o clube (a conta nova pelo código,
             o dono pela tela), a 1ª página cai no meio (as outras seguem, os bots também), o mesmo fim em todas
     oito    (O1–O3) 8 páginas, 104 lotes: o mesmo vivo, compras e caixas em todas e no servidor; os BYTES baixados do
             banco por página
     G0 a guarda pega (um pedido e um WebSocket de prova a *.firebaseio.com são barrados e contados) · G1 nenhuma página
     falou com o Firebase de verdade · G2 nenhum erro no console nem na página
   O campeonato (PR 3) e o par do Online 3D (PR 5) entram aqui nos PRs deles.
   Uma linha por item; o código de saída é 1 se algum reprovar (no CI, um job por caso: ~1, 2 e 3 min).
   Uso: node ferramentas/testar-leilao-online.mjs [endereço] [--so telas,dois,quatro,oito] [--fator 6] [--prints <pasta>] [-v]
   (o Chromium do Playwright: NODE_PATH com o playwright e, se preciso, PLAYWRIGHT_BROWSERS_PATH; como no golaco) */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WT = path.resolve(RAIZ, "..");
const args = process.argv.slice(2);
const opt = (n, p) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : p; };
const posicionais = args.filter((a, i) => !a.startsWith("-") && !(i > 0 && /^--(so|fator|prints)$/.test(args[i - 1])));
const SO = opt("--so", null) ? opt("--so").split(",").map(s => s.trim().toLowerCase()) : null;
const caso = n => !SO || SO.includes(n);
const FATOR = +opt("--fator", 6);
const PASTA = opt("--prints", "/tmp/testar-leilao-online");
const VERBOSO = args.includes("-v");
const LAT = 6;                  // a latência de cada mensagem (ms de verdade, cada sentido; × FATOR na hora do jogo)
const TOL_TARDE = 1500;         // o lance que entra depois do fim: tolerância (ms de jogo) do caminho da mensagem
fs.mkdirSync(PASTA, { recursive: true });

const { servidor, playwright } = await import(pathToFileURL(path.join(WT, "golaco/tools/lib/navegador.mjs")).href);
const { BancoFalso, relogioAcelerado } = await import(pathToFileURL(path.join(RAIZ, "ferramentas/lib/banco-falso.mjs")).href);

/* ---------- o TM.leilao em Node (as contas do servidor: o fim do lote, o "todos passaram", os times) ---------- */
const Lx = (() => {
  const ctx = { console, Math, Date, JSON };
  ctx.window = ctx; ctx.TM = {};
  vm.createContext(ctx);
  for (const f of ["js/rng.js", "js/leilao.js"]) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), "utf8"), ctx, { filename: f });
  return ctx.TM.leilao;
})();

/* ---------- o placar ---------- */
const oks = [], falhas = [];
function confere(nome, cond, info) {
  (cond ? oks : falhas).push(nome);
  console.log((cond ? "ok       " : "REPROVOU ") + nome + (cond && VERBOSO && info != null ? " — " + JSON.stringify(info).slice(0, 500) : ""));
  if (!cond && info != null) console.log("         · " + JSON.stringify(info).slice(0, 1500));
  return !!cond;
}
const t0 = performance.now();
const espera = ms => new Promise(r => setTimeout(r, ms));
const real = msJogo => msJogo / FATOR;   // quanto tempo de verdade dá tantos ms de jogo

/* ---------- o servidor, o banco falso e o relógio ---------- */
const rel = relogioAcelerado({ fator: FATOR });
const banco = new BancoFalso({ relogio: rel.agora, latencia: LAT });
const srv = posicionais[0] ? null : await servidor(0, RAIZ);
const BASE = (posicionais[0] || srv.url).replace(/\/$/, "");

// o servidor confere cada gravação do vivo: ninguém fecha antes do fim (pela hora do servidor), nenhum lance depois
const conf = {};   // código → { ctx, cedo: [], tarde: [], fechados, lances, maxAtraso, porT: [] }
const escreveOrig = banco._escreve.bind(banco);
banco._escreve = itens => {
  const vivos = [];
  for (const [ps] of itens) if (ps.length === 3 && ps[0] === "leiloes" && ps[2] === "vivo" && conf[ps[1]]) vivos.push(ps[1]);
  const antes = vivos.map(c => banco.ler("leiloes/" + c + "/vivo"));
  escreveOrig(itens);
  const hora = rel.agora();
  vivos.forEach((c, j) => {
    const C = conf[c], A = antes[j], B = banco.ler("leiloes/" + c + "/vivo");
    if (!C.ctx || !A || !B) return;
    const a = Lx.norm(A, C.ctx), b = Lx.norm(B, C.ctx), fimA = Lx.fimDoLote(a, C.ctx);
    if (a.fase === "fim" || a.i < 0) return;
    if (b.seq === a.seq && b.n > a.n) {
      C.lances++;
      const quem = b.lider; C.lancesPorT[quem] = (C.lancesPorT[quem] || 0) + 1; C.ultLance[quem] = hora;
      if (hora >= fimA) { C.maxAtraso = Math.max(C.maxAtraso, hora - fimA); if (hora - fimA > TOL_TARDE) C.tarde.push({ seq: a.seq, n: b.n, atraso: hora - fimA }); }
    }
    if (b.seq > a.seq) {
      C.fechados++; C.fechos.push({ a, hora, fim: fimA });
      if (hora < fimA && !Lx.todosPassaram(a, C.ctx)) {
        // antes do fim só fecha o passe que deixa todos passados
        let porPasse = false;
        for (let t = 0; t < C.ctx.T && !porPasse; t++) {
          if (t === a.lider || a.p.charAt(t) === "1") continue;
          const a2 = Object.assign({}, a, { p: a.p.slice(0, t) + "1" + a.p.slice(t + 1) });
          if (Lx.todosPassaram(a2, C.ctx) && b.p !== a2.p) porPasse = true;
        }
        if (!porPasse) C.cedo.push({ seq: a.seq, falta: fimA - hora });
      }
      // a compra fechada: quem levou (para os bots que seguem comprando depois da queda)
      if (a.i >= 0 && b.d.charAt(a.i) !== "-" && a.d.charAt(a.i) === "-") C.compras.push({ t: Lx.LETRAS.indexOf(b.d.charAt(a.i)), hora });
    }
  });
};
function vigia(codigo) {
  const C = conf[codigo] || (conf[codigo] = { ctx: null, cedo: [], tarde: [], fechados: 0, lances: 0, maxAtraso: 0, lancesPorT: {}, ultLance: {}, compras: [], fechos: [] });
  const lt = banco.ler("leiloes/" + codigo + "/lotes"), s = banco.ler("leiloes/" + codigo + "/sala");
  if (lt && s && s.ordem) C.ctx = Lx.contexto({ T: s.ordem.length, lotes: lt.l, fora: lt.f || [], semente: s.meta.semente, tempo: s.cfg.tempo });
  return C;
}
const sala = c => banco.ler("leiloes/" + c + "/sala");
const vivoServ = c => banco.ler("leiloes/" + c + "/vivo");

/* ---------- o que vai para cada página antes de tudo: a identidade, a captura de erros e o piloto ---------- */
function INICIO(o) {
  window.__fbUid = o.uid;
  try {
    localStorage.setItem("tm_online_name", o.nome);
    localStorage.setItem("totalmatch:__edition", o.ed);
    if (o.chave) localStorage.setItem("totalmatch:su_unlocked", "1");
  } catch (e) {}
  window.__errosPagina = [];
  addEventListener("error", e => window.__errosPagina.push(String(e.message || e).slice(0, 300)));
  addEventListener("unhandledrejection", e => window.__errosPagina.push("promessa: " + String(e.reason).slice(0, 300)));
  // Copiar convite e Compartilhar: o que a página mandou (nada sai daqui)
  window.__copiado = []; window.__compartilhado = [];
  try {
    const cb = navigator.clipboard || {};
    Object.defineProperty(cb, "writeText", { configurable: true, value: t => { window.__copiado.push(String(t)); return Promise.resolve(); } });
    if (!navigator.clipboard) Object.defineProperty(navigator, "clipboard", { configurable: true, value: cb });
  } catch (e) {}
  if (o.share) navigator.share = d => { window.__compartilhado.push(d); return Promise.resolve(); };
  // a página "escondida" (o celular bloqueado, outro app na frente): document.hidden e o visibilitychange
  window.__esconde = function (sim) {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => !!sim });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (sim ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange"));
  };
  // o piloto: decide como um robô com o perfil do seu índice e age pela tela ("tela") ou pela API da sessão ("api")
  const LT = window.__lt = { lances: [], pil: null };
  LT.embrulha = function () {
    const S = TM.leilaoSessao.atual();
    if (!S || S.__embrulhada) return S;
    S.__embrulhada = true;
    const orig = S.lance;
    S.lance = function (tipo) {
      const v = S.vivoN, reg = { tipo: String(tipo), seq: v && v.seq, n: v && v.n, i: v && v.i, eu: S.eu, fase: v && v.fase };
      const p = orig.apply(S, arguments);
      p.then(r => { reg.r = r; LT.lances.push(reg); }, e => { reg.erro = String(e); LT.lances.push(reg); });
      return p;
    };
    return S;
  };
  LT.pilotar = function (modo) {
    if (LT.pil) LT.pil.parar();
    const S = LT.embrulha();
    if (!S || !S.ctx || S.eu < 0) return false;
    const perfil = TM.leilao.perfilRobo(S.ctx.semente, S.eu);
    const P = LT.pil = { modo, eu: S.eu, codigo: S.codigo, acoes: 0, cliques: {}, falhas: 0, parado: false, pausado: false, pend: null, chave: null, dez: false };
    const conta = k => { P.cliques[k] = (P.cliques[k] || 0) + 1; };
    const botao = sel => { const b = document.querySelector(sel); return b && !b.disabled && b.offsetParent !== null ? b : null; };
    function olha() {
      if (P.parado) return;
      const v = S.vivoN;
      if (P.pausado || S.parado || !v || !S.ctx || v.fase === "fim" || !S.sala || S.sala.meta.estado !== "leilao" || S.eu < 0) { clearTimeout(P.pend); P.pend = null; P.chave = null; return; }
      const k = v.seq + ":" + v.n + ":" + v.p;
      if (k === P.chave) return;
      P.chave = k; clearTimeout(P.pend); P.pend = null;
      const a = TM.leilao.robo(v, S.ctx, perfil);
      if (!a) return;
      P.pend = setTimeout(() => { P.pend = null; age(a, k, 0); }, Math.max(0, a.quando + 3 - S.hora()));
    }
    function age(a, k, n) {
      if (P.parado || P.pausado) return;
      const v = S.vivoN;
      if (!v || v.seq + ":" + v.n + ":" + v.p !== k) return;
      if (n === 0) P.acoes++;
      if (modo === "api") { if (a.acao === "lance") { conta("api-lance"); S.lance(a.alvo); } else { conta("api-passar"); S.passar(); } return; }
      // pela tela: o botão que dá o alvo do robô (+1/+5/+10; Tudo quando o alvo é o máximo; senão Outro valor + Dar lance)
      const V = S.ver(), b = V.botoes;
      let feito = false;
      if (TM.ui.current() === "leilao-lote" && b) {
        if (a.acao === "passar") { const x = botao(".lei-lb-passar"); if (x) { x.click(); feito = true; conta("passar"); } }
        else {
          // uma vez no leilão, o +10 no lugar de um lance pequeno (cada botão de verdade passa pelo menos uma vez)
          let tipo = ["+1", "+5", "+10"].find(t => b[t].pode && b[t].alvo === a.alvo) || null;
          if (!tipo && !P.dez && b["+10"].pode && b["+10"].alvo <= Math.max(a.alvo, b["+10"].max) && v.valor + 10 <= Math.floor(b["+10"].max / 2)) { tipo = "+10"; P.dez = true; }
          if (tipo) { const x = botao(".lei-lb[data-tipo='" + tipo + "']"); if (x) { x.click(); feito = true; conta(tipo); } }
          else if (b.tudo.pode && b.tudo.alvo === a.alvo) { const x = botao(".lei-lb-tudo"); if (x) { x.click(); x.click(); feito = true; conta("tudo"); } }
          else if (b.outro.pode) {
            const inp = document.querySelector(".lei-valor"), dar = botao(".lei-lb-dar");
            if (inp && dar && !inp.disabled) { inp.value = String(a.alvo); inp.dispatchEvent(new Event("input", { bubbles: true })); dar.click(); feito = true; conta("outro"); }
          }
        }
      }
      if (!feito) { if (n < 6) setTimeout(() => age(a, k, n + 1), 150); else P.falhas++; }
    }
    const off = S.aoMudar(olha);
    P.parar = () => { P.parado = true; off(); clearTimeout(P.pend); };
    P.pausar = sim => { P.pausado = !!sim; clearTimeout(P.pend); P.pend = null; P.chave = null; if (!sim) olha(); };
    olha();
    return true;
  };
  LT.estado = () => (LT.pil ? { modo: LT.pil.modo, acoes: LT.pil.acoes, cliques: LT.pil.cliques, falhas: LT.pil.falhas } : null);
  LT.pausar = sim => { if (LT.pil) LT.pil.pausar(sim); };
  LT.parar = () => { if (LT.pil) LT.pil.parar(); LT.pil = null; };
}

/* ---------- os aparelhos ---------- */
const { chromium } = playwright();
const nav = await chromium.launch({ headless: true, ignoreDefaultArgs: ["--hide-scrollbars"] });
const erros = [];            // erros de página e de console (G2)
const firebaseReal = [];     // pedidos ao Firebase de verdade (G1)
const externos = new Set();  // os outros endereços de fora (informativo)
const RX_FIREBASE = /^(https?|wss?):\/\/([^/]*\.)?(firebaseio\.com|firebasedatabase\.app|firebaseapp\.com|googleapis\.com|firebase\.google\.com|firebaseinstallations)/;
const aparelhos = [];
async function aparelho(nome, uid, o = {}) {
  let cx = o.cx;
  if (!cx) {
    cx = await nav.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: 1, isMobile: !!o.toque, hasTouch: !!o.toque, serviceWorkers: "block" });
    // o Firebase de verdade: bloqueado e contado (o SDK falso nunca vai lá)
    await cx.route(RX_FIREBASE, r => { firebaseReal.push(nome + ": " + r.request().url().slice(0, 120)); r.abort(); });
    if (cx.routeWebSocket) await cx.routeWebSocket(RX_FIREBASE, ws => { firebaseReal.push(nome + " (ws): " + ws.url().slice(0, 120)); ws.close(); });
    cx.on("request", r => { const u = r.url(); if (RX_FIREBASE.test(u)) firebaseReal.push(nome + " (pedido): " + u.slice(0, 120)); else if (/^https?:/.test(u) && !u.startsWith(BASE) && !/^https:\/\/www\.gstatic\.com\//.test(u)) externos.add(u.replace(/^(https?:\/\/[^/]+).*$/, "$1")); });
    await banco.instalar(cx, { latencia: o.lat ?? LAT });   // o SDK do gstatic vira o falso, ligado ao banco daqui
    await cx.addInitScript(rel.scriptPagina(o.desvio || 0));
    await cx.addInitScript(INICIO, { uid, nome, ed: o.pro ? "pro" : "public", chave: !!o.chave, share: !!o.share });
  }
  const p = await cx.newPage();
  p.on("pageerror", e => erros.push(nome + ": " + String(e).slice(0, 300)));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR|prova-da-guarda/.test(m.text())) erros.push(nome + " (console): " + m.text().slice(0, 300)); });
  await p.goto(BASE + "/index.html" + (o.busca || ""), { waitUntil: "load" });
  await p.waitForFunction(() => window.TM && TM.ui && TM.leilaoSessao && TM.leilaoTela && TM.net && window.__lt, null, { timeout: 60000 });
  if (o.claro) await p.evaluate(() => TM.ui.applyTheme("light"));
  const ap = { nome, uid, cx, p, o };
  aparelhos.push(ap);
  if (aparelhos.length === 1) await provaGuarda(ap);
  return ap;
}
// G0: a guarda funciona — um pedido e um WebSocket de prova ao Firebase de verdade, da 1ª página, são barrados e contados
// (e saem da conta do G1)
let guarda = null;
async function provaGuarda(ap) {
  const n0 = firebaseReal.length;
  await ap.p.evaluate(() => {
    fetch("https://prova-da-guarda.firebaseio.com/.json").catch(() => {});
    try { const w = new WebSocket("wss://prova-da-guarda.firebaseio.com/.ws?v=5"); w.onerror = () => {}; } catch (e) {}
  });
  await ateNode(() => firebaseReal.slice(n0).some(x => /\(ws\)/.test(x)) && firebaseReal.slice(n0).some(x => !/\(ws\)/.test(x)), 5000);
  const provas = firebaseReal.slice(n0).filter(x => /prova-da-guarda/.test(x));
  guarda = { pedido: provas.some(x => !/\(ws\)/.test(x)), ws: provas.some(x => /\(ws\)/.test(x)), provas };
}
// a conta online pronta (o login anônimo pelo SDK falso)
async function conta(ap) {
  await ap.p.evaluate(() => TM.net.init());
  return ate(ap.p, () => TM.net.ready && TM.net.me && TM.net.me.uid, null, 30000);
}
async function ate(p, fn, arg, ms = 20000) { try { await p.waitForFunction(fn, arg, { timeout: ms, polling: 50 }); return true; } catch (e) { return false; } }
async function ateNode(fn, ms = 20000, passo = 50) { const fim = Date.now() + ms; while (Date.now() < fim) { if (await fn()) return true; await espera(passo); } return !!(await fn()); }
const ver = ap => ap.p.evaluate(() => { const S = TM.leilaoSessao.atual(); if (!S) return null; const V = S.ver(); return Object.assign({}, V, { vivo: S.vivo, sid: S.sid }); }).catch(() => null);
const rota = ap => ap.p.evaluate(() => TM.ui.current()).catch(() => null);
const telaTxt = ap => ap.p.evaluate(() => (document.querySelector(".screen.is-active") || document.body).innerText.replace(/\s+/g, " ")).catch(() => "");
const clica = (ap, rx, sel = "button") => ap.p.evaluate(([rx, sel]) => {
  const x = [...document.querySelectorAll(sel)].find(e => new RegExp(rx).test(e.textContent.trim()) && e.offsetParent !== null && !e.disabled);
  if (x) x.click(); return !!x;
}, [rx, sel]);
const clicaSel = (ap, sel) => ap.p.evaluate(s => { const x = document.querySelector(s); if (x && !x.disabled) { x.click(); return true; } return false; }, sel);
async function confirmaSheet(ap, rotulo) {
  await ate(ap.p, r => [...document.querySelectorAll(".sheet-overlay .sheet-item")].some(x => x.textContent.trim() === r), rotulo, 5000);
  return ap.p.evaluate(r => { const b = [...document.querySelectorAll(".sheet-overlay .sheet-item")].find(x => x.textContent.trim() === r); if (b) b.click(); return !!b; }, rotulo);
}
const print = (ap, nome) => ap.p.screenshot({ path: path.join(PASTA, nome + ".png"), fullPage: true }).catch(() => {});
const anuncios = ap => ap.p.evaluate(() => TM.leilaoTela.anuncios()).catch(() => []);
// entra com o código pela Entrada (o campo e o Entrar); devolve o texto do erro (ou null) depois de a tela responder
async function entrarPelaTela(ap, codigo) {
  await ap.p.evaluate(() => TM.ui.go("leilao"));
  await ate(ap.p, () => !!document.querySelector(".lei-entrar-cod"), null, 30000);
  await ap.p.fill(".lei-entrar-cod", codigo);
  await clicaSel(ap, ".lei-entrar-bt");
  await ate(ap.p, () => { const e = document.querySelector(".lei-erro"); return (e && !e.hidden && e.textContent) || TM.ui.current() !== "leilao"; }, null, 20000);
  return ap.p.evaluate(() => { const e = document.querySelector(".lei-erro"); return e && !e.hidden ? e.textContent : null; });
}
const pilotar = (ap, modo) => ap.p.evaluate(m => window.__lt.pilotar(m), modo).catch(() => false);
const pausaPiloto = (ap, sim) => ap.p.evaluate(s => window.__lt.pausar(s), sim).catch(() => {});
const piloto = ap => ap.p.evaluate(() => window.__lt.estado()).catch(() => null);

/* ---------- nada sobre nada (o critério do testar-leilao.mjs --tela, com as peças do saguão) ---------- */
const sobreposicao = p => p.evaluate(() => {
  const sel = "button, a[href], [role=button], input, select, .ut-card, .lei-placar, .lei-meu, .lei-bloco, .next-match, .lei-sala, .lei-caixa, .lei-part, .lei-pedido, .lei-etq, .qr-box";
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
  const clicavel = e => e.matches("button, a[href], [role=button], input, select");
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const X = els[i], Y = els[j];
    if (X.contains(Y) || Y.contains(X) || camada(X) !== camada(Y)) continue;
    const a = X.getBoundingClientRect(), bb = Y.getBoundingClientRect();
    const ix = Math.min(a.right, bb.right) - Math.max(a.left, bb.left), iy = Math.min(a.bottom, bb.bottom) - Math.max(a.top, bb.top);
    if (ix > 1 && iy > 1) pares.push(nome(X) + " X " + nome(Y));
    else if (ix > -2 && iy > -2 && clicavel(X) && clicavel(Y)) encostam.push(nome(X) + " | " + nome(Y) + " (" + Math.round(Math.max(-ix, -iy) * 10) / 10 + " px)");
  }
  const saem = [];
  els.filter(e => e.matches("button")).forEach(b => {
    const rb = b.getBoundingClientRect();
    b.querySelectorAll("span, div, small, strong, b").forEach(x => {
      if (!x.childNodes.length || ![...x.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
      const cs = getComputedStyle(x); if (cs.display === "none" || cs.visibility === "hidden") return;
      const r = x.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
      if (r.left < rb.left - 1 || r.right > rb.right + 1 || r.top < rb.top - 1 || r.bottom > rb.bottom + 1) saem.push(nome(x) + " em " + nome(b));
    });
  });
  const larg = document.documentElement.clientWidth;
  const fora = els.filter(e => { const rc = e.getBoundingClientRect(); return rc.right > larg + 1 || rc.left < -1; }).map(nome);
  // no fim da rolagem, o último da página termina acima da barra fixa (a de lance ou a do saguão)
  let atras = null;
  const barra = document.querySelector(".lei-lance:not([hidden]), .lei-sagbar:not([hidden])");
  if (barra) {
    const y0 = scrollY; scrollTo(0, document.documentElement.scrollHeight);
    const topo = barra.getBoundingClientRect().top;
    const baixo = els.filter(e => !camada(e)).map(e => e.getBoundingClientRect().bottom);
    const fundo = Math.max(...baixo);
    if (fundo > topo + 1) atras = Math.round(fundo - topo);
    scrollTo(0, y0);
  }
  return { n: els.length, sobre: pares, encostam, saem, fora, rolaLado: document.documentElement.scrollWidth > larg + 1, atras, barra: !!barra };
});
const TAMANHOS = [[360, 740], [844, 390], [1280, 800]];
// mede a tela nos 3 tamanhos, no escuro e no claro; devolve as medidas ruins (e a quantidade de medidas)
async function nadaSobreNada(ap, rotulo, pronto) {
  const ruins = [], medidas = [];
  const vp0 = ap.p.viewportSize();
  for (const tema of ["dark", "light"]) {
    await ap.p.evaluate(t => TM.ui.applyTheme(t), tema);
    for (const [w, h] of TAMANHOS) {
      await ap.p.setViewportSize({ width: w, height: h });
      await espera(280);
      if (pronto) await ate(ap.p, pronto, null, 5000);
      await ap.p.evaluate(() => { document.querySelectorAll(".toast").forEach(t => t.remove()); scrollTo(0, 0); });
      const s = await sobreposicao(ap.p);
      const r = { tela: `${rotulo} ${tema === "light" ? "claro" : "escuro"} ${w}x${h}`, n: s.n, barra: s.barra, sobre: s.sobre.slice(0, 4), encostam: s.encostam.slice(0, 4), saem: s.saem.slice(0, 4), fora: s.fora.slice(0, 4), rolaLado: s.rolaLado, atras: s.atras };
      medidas.push(r);
      if (r.sobre.length || r.encostam.length || r.saem.length || r.fora.length || r.rolaLado || r.atras) ruins.push(r);
      await print(ap, `nada-${rotulo}-${tema === "light" ? "claro" : "escuro"}-${w}x${h}`);
    }
  }
  await ap.p.evaluate(() => TM.ui.applyTheme("dark"));
  await ap.p.setViewportSize(vp0);
  await espera(200);
  return { ruins, medidas };
}

/* ---------- as conferências do fim ---------- */
// o mesmo vivo em todas as páginas e no servidor; as vendas registradas = o vivo; o caixa = 100 − as vendas; os 11 de cada
// um cabem numa formação; ninguém congelou uma sala honesta
async function fimIgual(id, aps, codigo) {
  const C = vigia(codigo), vS = vivoServ(codigo), ctx = C.ctx;
  const vs = await Promise.all(aps.map(ver));
  const iguais = vs.every(V => V && JSON.stringify(V.vivo) === JSON.stringify(vS));
  const v = Lx.norm(vS, ctx), vd = banco.ler("leiloes/" + codigo + "/vendas") || {}, soma = new Array(ctx.T).fill(0);
  let erradas = 0, n = 0;
  Object.keys(vd).forEach(k => { const x = vd[k]; if (!x) return; n++; if (Lx.LETRAS.indexOf(v.d.charAt(+k)) !== x.t) erradas++; soma[x.t] += x.v; });
  const vendidos = v.d.split("").filter(c => c !== "-").length;
  const caixas = [], times = [];
  for (let t = 0; t < ctx.T; t++) {
    caixas.push([v.cx[t][0], Lx.SALDO - soma[t]]);
    const time = Lx.timeDe(v, ctx, t);
    times.push(time.length === 11 && Lx.formacoesQueCabem(Lx.contaMascaras(time)).length > 0);
  }
  return {
    ok: v.fase === "fim" && iguais && !erradas && n === vendidos && caixas.every(([a, b]) => a === b) && times.every(Boolean) && vs.every(V => V && !V.alterada),
    info: { fase: v.fase, iguais, vendas: n, vendidos, erradas, caixas: caixas.filter(([a, b]) => a !== b), times, alteradas: vs.map(V => V && V.alterada), seqs: vs.map(V => V && V.vivo && V.vivo.seq) }
  };
}
function confOk(id, codigo) {
  const C = conf[codigo];
  return confere(`${id} o servidor: nenhum lote fechou antes do fim (${C.fechados} fechados) e nenhum lance entrou mais de ${TOL_TARDE / 1000} s depois (${C.lances} lances; o pior atraso ${Math.round(C.maxAtraso)} ms de jogo)`,
    !C.cedo.length && !C.tarde.length, { cedo: C.cedo.slice(0, 4), tarde: C.tarde.slice(0, 4) });
}
// espera o leilão acabar no servidor e, depois, o mesmo vivo em todas as páginas (até 20 s: uma página sem a sala não segura
// o teste até o fim do prazo)
async function ateOFim(codigo, aps, msReal) {
  const noFim = () => { const v = vivoServ(codigo); return !!(v && conf[codigo] && conf[codigo].ctx && Lx.norm(v, conf[codigo].ctx).fase === "fim"); };
  if (!(await ateNode(noFim, msReal, 300))) return false;
  return ateNode(async () => {
    const v = vivoServ(codigo), vs = await Promise.all(aps.map(ver));
    return vs.every(V => V && JSON.stringify(V.vivo) === JSON.stringify(v));
  }, 20000, 200);
}
// um lote em que a página pode dar +1 (o lote liberado, ninguém liderando por ela), com o vivo igual nas páginas dadas
async function loteLivre(aps, msReal = 60000, extra) {
  return ateNode(async () => {
    const vs = await Promise.all(aps.map(ver));
    if (!vs.every(V => V && V.botoes && V.botoes["+1"].pode && V.lote && !V.lote.pausa && V.lote.restante > 4000 && V.rede === "ok" && !V.conferindo)) return false;
    if (!vs.every(V => JSON.stringify(V.vivo) === JSON.stringify(vs[0].vivo))) return false;
    return !extra || extra(vs);
  }, msReal, 40);
}

/* ====================================================================================================== */
async function casoDois() {
  const ID = "D";
  // Ana (dono, celular em pé, com o navigator.share), Bruno (PC), Carla (celular deitado; a recusada), Eva (celular estreito;
  // as recusas na tela)
  const A = await aparelho("Ana", "uidAna", { w: 390, h: 844, toque: true, share: true });
  const B = await aparelho("Bruno", "uidBruno", { w: 1280, h: 800 });
  const Cc = await aparelho("Carla", "uidCarla", { w: 844, h: 390, toque: true });
  const E = await aparelho("Eva", "uidEva", { w: 360, h: 740, toque: true });

  /* D1 criar sala pela tela */
  await A.p.evaluate(() => TM.ui.go("leilao"));
  await ate(A.p, () => [...document.querySelectorAll(".lei-online button")].some(b => /Criar sala/.test(b.textContent) && !b.disabled), null, 30000);
  await clica(A, "^Criar sala$");
  await ate(A.p, () => TM.ui.current() === "leilao-criar" && !!document.querySelector(".lei-comecar"), null, 15000);
  // 2 técnicos, sem bots (o padrão é 4: duas vezes o "Menos um técnico")
  for (let k = 0; k < 6; k++) { const n = await A.p.evaluate(() => +document.querySelector('[aria-label="Técnicos na sala"] .lei-passo-n').textContent); if (n <= 2) break; await clicaSel(A, '[aria-label="Menos um técnico"]'); await espera(60); }
  await clicaSel(A, ".lei-comecar");
  await ate(A.p, () => TM.ui.current() === "leilao-saguao" && !!document.querySelector(".lei-conv-cod") && TM.leilaoSessao.atual(), null, 30000);
  const cod = await A.p.evaluate(() => TM.leilaoSessao.atual().codigo);
  let s = sala(cod);
  const escondido = await A.p.evaluate(() => ({ txt: document.querySelector(".lei-conv-cod").textContent, qr: !!document.querySelector(".lei-qr svg"), topo: (document.querySelector(".topbar") || document.body).innerText }));
  await clicaSel(A, ".lei-olho");
  await ate(A.p, () => TM.leilaoTela.estado().codigoVisivel && !!document.querySelector(".lei-qr svg"), null, 5000);
  const visto = await A.p.evaluate(() => ({ txt: document.querySelector(".lei-conv-cod").textContent, qr: !!document.querySelector(".lei-qr svg") }));
  await clica(A, "^Copiar convite$");
  await clica(A, "^Compartilhar$");
  await espera(100);
  const conv = await A.p.evaluate(() => ({ copiado: window.__copiado.slice(), comp: window.__compartilhado.map(d => d.url) }));
  confere(`${ID}1 criar sala pela tela: a sala ${cod} no saguão (dono, regras, edição pública, 2 vagas, sem bots), o código ••••• até o olho, o QR só com o código à mostra, Copiar convite e Compartilhar com o link ?leilao=`,
    /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(cod) && s && s.meta.estado === "saguao" && s.meta.dono === "uidAna" && s.meta.regras === Lx.REGRAS && s.meta.edicao === "public" && s.cfg.vagas === 2 && s.cfg.bots === 0 &&
      !escondido.txt.includes(cod) && !escondido.qr && !escondido.topo.includes(cod) && visto.txt.includes(cod) && visto.qr &&
      conv.copiado.length === 1 && conv.copiado[0].endsWith("?leilao=" + cod) && conv.comp.length === 1 && conv.comp[0] === conv.copiado[0],
    { cod, meta: s && s.meta, cfg: s && s.cfg, escondido, visto, conv });

  /* D3 o pedido pelo código e o dono RECUSA (antes do Bruno: com 2 vagas, a sala enche) */
  await conta(Cc);
  const errC = await entrarPelaTela(Cc, cod.toLowerCase());
  await ate(Cc.p, () => TM.ui.current() === "leilao-saguao" && TM.leilaoSessao.atual() && TM.leilaoSessao.atual().pedido, null, 15000);
  const esperaC = await telaTxt(Cc);
  await ate(A.p, () => !!document.querySelector(".lei-pedido[data-uid='uidCarla']"), null, 15000);
  await A.p.evaluate(() => [...document.querySelectorAll(".lei-pedido[data-uid='uidCarla'] button")].find(b => /Recusar/.test(b.textContent)).click());
  await ate(Cc.p, () => TM.ui.current() === "leilao" && !TM.leilaoSessao.atual(), null, 15000);
  await espera(150);
  const recadoC = await Cc.p.evaluate(() => { const x = document.querySelector(".lei-aviso-entrada"); return x ? x.textContent : null; });
  const errC2 = await entrarPelaTela(Cc, cod);
  s = sala(cod);
  confere(`${ID}3 o pedido pelo código (minúsculas) e o dono recusa pela tela: quem pediu volta à Entrada com o recado, fica em recusados e não pede de novo`,
    errC == null && /Esperando o dono aceitar/.test(esperaC) && /recusou/.test(recadoC || "") && /recusou a sua entrada/.test(errC2 || "") && s.recusados && s.recusados.uidCarla && !(s.pedidos && s.pedidos.uidCarla),
    { errC, esperaC: esperaC.slice(0, 200), recadoC, errC2, recusados: s.recusados });

  /* D2 o pedido pelo LINK (?leilao=) e o dono ACEITA */
  await B.p.goto(BASE + "/index.html?leilao=" + cod, { waitUntil: "load" });
  await B.p.waitForFunction(() => window.TM && TM.ui && TM.leilaoSessao && window.__lt, null, { timeout: 60000 });
  const pediu = await ate(B.p, () => TM.ui.current() === "leilao-saguao" && TM.leilaoSessao.atual() && TM.leilaoSessao.atual().pedido, null, 30000);
  const pedidoA = await ate(A.p, () => !!document.querySelector(".lei-pedido[data-uid='uidBruno']"), null, 15000);
  await A.p.evaluate(() => [...document.querySelectorAll(".lei-pedido[data-uid='uidBruno'] button")].find(b => /Aceitar/.test(b.textContent)).click());
  const aceito = await ate(B.p, () => { const S = TM.leilaoSessao.atual(); return S && !S.pedido && S.eu === 1; }, null, 15000);
  await ate(A.p, () => !!document.querySelector(".lei-part[data-uid='uidBruno']"), null, 10000);
  const anB = await anuncios(B), compB = await B.p.evaluate(() => ({ share: !!navigator.share, bt: [...document.querySelectorAll("button")].some(b => /^Compartilhar$/.test(b.textContent.trim())) }));
  s = sala(cod);
  confere(`${ID}2 o pedido pelo link ?leilao= (a Entrada entra sozinha) e o dono aceita pela tela: o técnico novo no saguão; sem navigator.share, sem o Compartilhar`,
    pediu && pedidoA && aceito && s.tec.uidBruno && s.tec.uidBruno.papel === "tecnico" && !s.pedidos && anB.some(x => /aceitou/.test(x)) && !compB.share && !compB.bt,
    { pediu, pedidoA, aceito, tec: Object.keys(s.tec || {}), anB: anB.slice(-3), compB });

  /* D4 as recusas na tela: código errado, sala cheia, edição, regras diferentes */
  await conta(E);
  const e1 = await entrarPelaTela(E, "AB12");
  const e2 = await entrarPelaTela(E, "ZZZZZZ");
  const e3 = await entrarPelaTela(E, cod);
  const agora = rel.agora();
  const falsa = (edicao, regras) => ({
    meta: { dono: "uidXis", proto: 1, regras, versaoTM: "v0", edicao, criada: agora, estado: "saguao", semente: "1", atividade: agora },
    cfg: { liga: "br", ligaNome: "Brasil", vagas: 4, bots: 0, tempo: 10000, formato: "mata", overall: "mostra" },
    tec: { uidXis: { nome: "Xis", papel: "dono", pronto: true, entrou: 0, clube: { nome: "Xis FC", sigla: "XIS", cor: "#3b82f6", escudo: "classico|tm-bola" } } }
  });
  banco.gravar("leiloes/EDPR23/sala", falsa("pro", Lx.REGRAS));
  banco.gravar("leiloes/RGRS23/sala", falsa("public", Lx.REGRAS + 1));
  const e4 = await entrarPelaTela(E, "EDPR23");
  const e5 = await entrarPelaTela(E, "RGRS23");
  const edE = await E.p.evaluate(() => TM.storage.edition());
  confere(`${ID}4 as recusas na tela: código curto, código que não existe, sala cheia, Season Update sem a chave, regras de outra versão`,
    /6 letras/.test(e1 || "") && /não encontrado/.test(e2 || "") && /cheia/.test(e3 || "") && /Season Update/.test(e4 || "") && /outra versão das regras/.test(e5 || "") && edE === "public" &&
      !(sala("EDPR23").pedidos) && !(sala("RGRS23").pedidos) && !(sala(cod).pedidos),
    { e1, e2, e3, e4, e5, edE });

  /* D6 nada sobre nada no Saguão: o dono e o convidado */
  const nsDono = await nadaSobreNada(A, "saguao-dono", () => !!document.querySelector(".lei-sagbar"));
  const nsConv = await nadaSobreNada(B, "saguao-convidado", () => !!document.querySelector(".lei-sagbar"));
  confere(`${ID}6 nada sobre nada no Saguão (o dono e o convidado) em 360×740, 844×390 e 1280×800, no escuro e no claro (${nsDono.medidas.length + nsConv.medidas.length} medidas)`,
    !nsDono.ruins.length && !nsConv.ruins.length && nsDono.medidas.every(m => m.n > 8 && m.barra), nsDono.ruins.concat(nsConv.ruins).slice(0, 4));

  /* D5 o Pronto e o Começar pela tela */
  await clicaSel(B, ".lei-sagbar-bt");
  const todos = await ate(A.p, () => /Todos prontos/.test(TM.leilaoTela.estado().barra || ""), null, 15000);
  await clicaSel(A, ".lei-sagbar-bt");
  const foi = await ateNode(async () => (await rota(A)) === "leilao-lote" && (await rota(B)) === "leilao-lote", 30000);
  await ateNode(() => vivoServ(cod) && vigia(cod).ctx, 20000);
  s = sala(cod);
  const vA = await ver(A), vB = await ver(B);
  confere(`${ID}5 o Pronto do convidado e o Começar do dono pela tela: as duas páginas vão sozinhas à aba Leilão com o mesmo vivo (26 lotes)`,
    todos && foi && s.meta.estado === "leilao" && s.ordem && s.ordem.join() === "uidAna,uidBruno" && vigia(cod).ctx && vigia(cod).ctx.fila.length === 26 && vA && vB && JSON.stringify(vA.vivo) === JSON.stringify(vB.vivo),
    { todos, foi, estado: s.meta.estado, ordem: s.ordem });
  vigia(cod);

  /* os pilotos nas duas páginas (D7), parados enquanto o teste faz os lances à mão (D8–D10) */
  await pilotar(A, "tela"); await pilotar(B, "tela");
  await pausaPiloto(A, true); await pausaPiloto(B, true);

  /* D8 dois lances no mesmo instante: um vence, o outro vê "Alguém chegou antes" */
  let corrida = null;
  for (let tenta = 0; tenta < 4 && !corrida; tenta++) {
    if (!(await loteLivre([A, B], 40000))) break;
    const nA = await A.p.evaluate(() => window.__lt.lances.length), nB = await B.p.evaluate(() => window.__lt.lances.length);
    const toca = () => { const b = document.querySelector(".lei-lb[data-tipo='+1']"); if (!b || b.disabled) return false; b.click(); return true; };
    const [cA, cB] = await Promise.all([A.p.evaluate(toca), B.p.evaluate(toca)]);
    await ate(A.p, n => window.__lt.lances.length > n, nA, 10000); await ate(B.p, n => window.__lt.lances.length > n, nB, 10000);
    const lA = await A.p.evaluate(n => window.__lt.lances[n], nA), lB = await B.p.evaluate(n => window.__lt.lances[n], nB);
    if (cA && cB && lA && lB && lA.r && lB.r && lA.seq === lB.seq && [lA.r, lB.r].filter(r => r.ok).length === 1 && [lA.r, lB.r].some(r => r.estado === "antes")) corrida = { lA, lB };
  }
  await espera(80);
  const anA = await anuncios(A), anB2 = await anuncios(B);
  const perdeu = corrida && (corrida.lA.r.ok ? anB2 : anA), venceu = corrida && (corrida.lA.r.ok ? anA : anB2);
  confere(`${ID}8 dois +1 no mesmo instante pela tela: um vence ("Seu lance de R$ 1 foi aceito"), o outro vê "Alguém chegou antes: R$ 1"`,
    !!corrida && venceu.some(x => /Seu lance de R\$ 1 foi aceito/.test(x)) && perdeu.some(x => /Alguém chegou antes: R\$ 1/.test(x)),
    { corrida, anA: anA.slice(-4), anB: anB2.slice(-4) });

  /* D9 o ack perdido: o servidor grava e a conexão cai antes da resposta → "Conferindo…" e, na volta, o resultado certo
     (se a queda pegar o ack de um batimento antes do lance, o lance nem saiu: tenta de novo) */
  let ack = null;
  for (let tenta = 0; tenta < 4 && !(ack && ack.ok); tenta++) {
    if (!(await loteLivre([A, B], 40000))) break;
    const antes = await B.p.evaluate(() => window.__lt.lances.length);
    banco.cairNoProximoAck(B.p);
    await clicaSel(B, ".lei-lb[data-tipo='+1']");
    const viuConf = await ate(B.p, () => /Conferindo/.test((document.querySelector(".lei-lance-msg") || {}).textContent || ""), null, 8000);
    const botoesOff = await B.p.evaluate(() => [...document.querySelectorAll(".lei-l1 .lei-lb")].every(b => b.disabled));
    await espera(real(1500));
    for (const C2 of banco._clis(B.p)) C2.cairNoAck = 0;
    banco.conectar(B.p);
    await ate(B.p, n => window.__lt.lances.length > n, antes, 20000);
    const reg = await B.p.evaluate(n => window.__lt.lances[n], antes);
    await ate(B.p, () => TM.leilaoSessao.atual().ver().rede === "ok", null, 20000);
    const vv = Lx.norm(vivoServ(cod), vigia(cod).ctx);
    // o resultado certo: aceito ⇔ o lance de Bruno (técnico 1, o valor dele) entrou no lote em que ele tocou
    let entrou = false;
    if (reg && reg.r) {
      if (vv.seq === reg.seq) entrou = vv.h.some(h => h[0] === 1 && h[1] === reg.r.valor) || vv.lider === 1;
      else entrou = reg.i >= 0 && vv.d.charAt(reg.i) === Lx.letra(1);
    }
    const anBa = await anuncios(B);
    ack = { tenta, viuConf, botoesOff, reg, entrou, an: anBa.slice(-3) };
    ack.ok = viuConf && botoesOff && reg && reg.r && reg.r.conferido && (!!reg.r.ok === entrou) && (!reg.r.ok || anBa.some(x => /foi aceito/.test(x)));
  }
  confere(`${ID}9 o ack perdido: "Conferindo…" na linha da barra com os botões apagados e, na volta, o resultado certo (conferido pelo vivo)`, !!(ack && ack.ok), ack);

  /* D10 o lance velho guardado: o que sobe do Bruno fica parado 60 s (o socket meio aberto); o lote fecha sem ele e vai à
     repescagem; quando o lance chega, é recusado */
  let velho = null;
  if (await loteLivre([A, B], 60000, vs => vs[0].lote.fase === "lotes" && vs[0].lote.n === 0)) {
    const r0 = await ver(B), i0 = r0.lote.i, seq0 = r0.lote.seq;
    const antes = await B.p.evaluate(() => window.__lt.lances.length);
    banco.definirLatencia(B.p, { sobe: real(60000), desce: LAT });
    await B.p.evaluate(() => { TM.leilaoSessao.atual().lance("+1"); });
    await espera(30);
    banco.definirLatencia(B.p, LAT);
    // a Ana passa pela tela: o lote fecha sem lance (vai para a repescagem)
    await ate(A.p, () => { const b = document.querySelector(".lei-lb-passar"); return b && !b.disabled; }, null, 10000);
    await clicaSel(A, ".lei-lb-passar");
    const respondeu = await ate(B.p, n => window.__lt.lances.length > n, antes, real(90000) + 30000);
    const reg = await B.p.evaluate(n => window.__lt.lances[n], antes);
    await ate(B.p, () => TM.leilaoSessao.atual().ver().rede === "ok", null, 30000);
    const vv = Lx.norm(vivoServ(cod), vigia(cod).ctx);
    velho = { respondeu, reg, seq0, seqAgora: vv.seq, dono: vv.d.charAt(i0), naRep: vv.sem.includes(i0), i0 };
    velho.ok = respondeu && reg && reg.r && !reg.r.ok && (reg.r.estado === "fechado" || reg.r.motivo === "velho") && vv.seq > seq0 && vv.d.charAt(i0) !== Lx.letra(1);
  }
  await pausaPiloto(A, false); await pausaPiloto(B, false);
  confere(`${ID}10 o lance velho guardado (o que sobe parado 60 s): o lote fecha sem ele (a repescagem) e, quando ele chega, é recusado`, !!(velho && velho.ok), velho);

  /* D12 nada sobre nada no Leilão online (o convidado, com a barra de lance e o relógio rodando) */
  const nsLote = await nadaSobreNada(B, "leilao", () => !!document.querySelector(".lei-lance:not([hidden])"));
  confere(`${ID}12 nada sobre nada no Leilão online em 360×740, 844×390 e 1280×800, no escuro e no claro (${nsLote.medidas.length} medidas, com a barra de lance)`,
    !nsLote.ruins.length && nsLote.medidas.every(m => m.barra && m.n > 8), nsLote.ruins.slice(0, 4));

  /* D11 recarregar no meio: o Bruno pelo ?leilao= e a Ana pelas Minhas salas, depois do deploy (versaoTM diferente) */
  await ateNode(async () => { const v = vivoServ(cod); return v && v.seq >= 8; }, real(400000), 200);
  const tB = (await ver(B)).eu;
  await B.p.goto(BASE + "/index.html?leilao=" + cod, { waitUntil: "load" });
  await B.p.waitForFunction(() => window.TM && TM.ui && TM.leilaoSessao && window.__lt, null, { timeout: 60000 });
  const voltouB = await ate(B.p, () => TM.ui.current() === "leilao-lote" && TM.leilaoSessao.atual() && TM.leilaoSessao.atual().eu === 1 && TM.leilaoSessao.atual().vivoN, null, 30000);
  await pilotar(B, "tela");
  banco.gravar(`leiloes/${cod}/sala/meta/versaoTM`, "v-velha");
  await A.p.reload({ waitUntil: "load" });
  await A.p.waitForFunction(() => window.TM && TM.ui && TM.leilaoSessao && window.__lt, null, { timeout: 60000 });
  // (com a conta ainda entrando, o Voltar de uma sala online pede para tentar de novo em instantes: espera a conta)
  await A.p.evaluate(() => TM.ui.go("leilao"));
  await conta(A);
  await A.p.evaluate(() => TM.ui.go("leilao"));
  const listou = await ate(A.p, c => !!document.querySelector(".lei-sala.online[data-codigo='" + c + "'] .btn"), cod, 30000);
  const txtSala = await A.p.evaluate(c => { const x = document.querySelector(".lei-sala[data-codigo='" + c + "']"); return x ? x.innerText.replace(/\s+/g, " ") : null; }, cod);
  await A.p.evaluate(c => document.querySelector(".lei-sala[data-codigo='" + c + "'] .btn").click(), cod);
  const voltouA = await ate(A.p, () => /^leilao-(lote|escalacao)$/.test(TM.ui.current()) && TM.leilaoSessao.atual() && TM.leilaoSessao.atual().eu === 0 && TM.leilaoSessao.atual().vivoN, null, 30000);
  const VA = await ver(A);
  await A.p.evaluate(() => TM.ui.go("leilao-saguao"));
  const nota = await ate(A.p, () => /outra versão do Total Match/.test(document.body.innerText), null, 8000);
  await A.p.evaluate(() => TM.ui.go("leilao-lote"));
  await pilotar(A, "tela");
  confere(`${ID}11 recarregar no meio: o convidado volta pelo ?leilao= e o dono pelas Minhas salas ("Leilão em andamento"), depois do deploy (versaoTM diferente: quem é da sala volta e vê o aviso)`,
    tB === 1 && voltouB && listou && /Leilão em andamento/.test(txtSala || "") && voltouA && VA && VA.eu === 0 && !VA.soOlhar && VA.versaoDiferente && nota,
    { tB, voltouB, listou, txtSala, voltouA, eu: VA && VA.eu, soOlhar: VA && VA.soOlhar, versaoDiferente: VA && VA.versaoDiferente, nota });

  /* D13 o fim igual nas duas páginas e no servidor */
  const acabou = await ateOFim(cod, [A, B], real(26 * 40000) + 60000);
  const pA = await piloto(A), pB = await piloto(B);
  const fim = await fimIgual(ID, [A, B], cod);
  const cliques = {}; [pA, pB].forEach(x => x && Object.keys(x.cliques).forEach(k => { cliques[k] = (cliques[k] || 0) + x.cliques[k]; }));
  confere(`${ID}7 o leilão inteiro pelos botões nas duas páginas (${JSON.stringify(cliques)})`,
    acabou && pA && pB && pA.acoes > 0 && pB.acoes > 0 && cliques.passar > 0 && cliques["+1"] > 0 && cliques["+10"] > 0 && (cliques["+5"] || 0) + (cliques.outro || 0) > 0,
    { acabou, pA, pB });
  confere(`${ID}13 o fim igual nas duas páginas e no servidor: as compras, os caixas (100 − as vendas registradas) e os 11 de cada um`, acabou && fim.ok, fim.info);
  confOk(`${ID}13b`, cod);

  /* D14 a escalação pela tela (o Pronto nas duas) e o campeonato "em breve" */
  const naEsc = await ateNode(async () => (await rota(A)) === "leilao-escalacao" && (await rota(B)) === "leilao-escalacao", 20000);
  await ate(A.p, () => [...document.querySelectorAll(".lei-screen button")].some(b => /^Pronto/.test(b.textContent.trim()) && !b.disabled), null, 10000);
  await clica(A, "^Pronto$"); await clica(B, "^Pronto$");
  const camp = await ateNode(() => { const x = sala(cod); return x && x.meta.estado === "camp"; }, 30000);
  await A.p.evaluate(() => TM.ui.go("leilao-camp"));
  const emBreve = await ate(A.p, () => /em breve/i.test((document.querySelector(".screen.is-active") || document.body).innerText), null, 8000);
  confere(`${ID}14 a escalação pela tela: as duas páginas vão sozinhas à Escalação, o Pronto nas duas leva ao campeonato ("em breve" até o PR 3)`, naEsc && camp && emBreve, { naEsc, camp, emBreve });
  for (const ap of [A, B, Cc, E]) await ap.cx.close().catch(() => {});
}

/* ====================================================================================================== */
// junta N páginas na sala de um dono pela API (o pedido, o aceite e o Pronto): os casos grandes
async function salaPelaApi(aps, cfg) {
  const [dono, ...outros] = aps;
  for (const ap of aps) await conta(ap);
  const cod = await dono.p.evaluate(c => TM.leilaoSessao.criarSala(c).then(S => S.codigo), cfg);
  for (const ap of outros) await ap.p.evaluate(c => TM.leilaoSessao.entrar(c).then(() => true), cod);
  await ate(dono.p, n => { const V = TM.leilaoSessao.atual().ver(); return V.saguao && V.saguao.pedidos.length === n; }, outros.length, 30000);
  for (const ap of outros) await dono.p.evaluate(u => TM.leilaoSessao.atual().aceitar(u), ap.uid);
  for (const ap of outros) await ate(ap.p, () => { const S = TM.leilaoSessao.atual(); return S && S.eu >= 0 && !S.pedido; }, null, 20000);
  for (const ap of outros) await ap.p.evaluate(() => TM.leilaoSessao.atual().pronto(true));
  await ate(dono.p, () => { const V = TM.leilaoSessao.atual().ver(); return V.saguao && V.saguao.podeComecar; }, null, 30000);
  const r = await dono.p.evaluate(() => TM.leilaoSessao.atual().comecar());
  await ateNode(async () => { const vs = await Promise.all(aps.map(ver)); return vs.every(V => V && V.vivo && V.estado === "leilao"); }, 30000);
  vigia(cod);
  return { cod, r };
}

async function casoQuatro() {
  const ID = "Q";
  // 0 o dono (celular), 1 o PC com o relógio +5 s, 2 o celular deitado com −5 s, 3 o celular estreito (o pulo de +60 s e o
  // que some); + 2 bots
  const P0 = await aparelho("Quatro-0", "uidQ0", { w: 390, h: 844, toque: true });
  const P1 = await aparelho("Quatro-1", "uidQ1", { w: 1280, h: 800, desvio: 5000, lat: 10 });
  const P2 = await aparelho("Quatro-2", "uidQ2", { w: 844, h: 390, toque: true, desvio: -5000, lat: 16 });
  const P3 = await aparelho("Quatro-3", "uidQ3", { w: 360, h: 740, toque: true, lat: 22 });
  const aps = [P0, P1, P2, P3];
  const { cod, r } = await salaPelaApi(aps, { liga: "br", vagas: 6, bots: 2, tempo: 10 });
  const C = vigia(cod), s = sala(cod);
  confere(`${ID}1 4 páginas + 2 bots na sala (o pedido, o aceite e o Pronto pela API) e o Começar: 6 técnicos, 78 lotes, o mesmo vivo em todas`,
    r && r.ok && s.ordem.length === 6 && C.ctx && C.ctx.fila.length === 78 && s.ordem.slice(4).every(u => s.tec[u].papel === "bot"), { r, ordem: s.ordem });
  for (const ap of aps) await ap.p.evaluate(() => TM.ui.go("leilao-lote"));
  await pilotar(P0, "tela"); await pilotar(P1, "tela"); await pilotar(P2, "api"); await pilotar(P3, "api");

  /* Q2 o relógio de parede da página 3 pula +60 s DEPOIS da calibração (a 1ª testemunha) */
  const calibrou = await ate(P3.p, () => { const S = TM.leilaoSessao.atual(); return S && S.rede._hora && S.rede._hora().escolhida; }, null, 20000);
  const desvio = await P3.p.evaluate(() => window.__relogioPula(60000));
  const horaDepois = await P3.p.evaluate(() => TM.leilaoSessao.atual().hora());
  await espera(real(8000));
  const horaDepois2 = await P3.p.evaluate(() => TM.leilaoSessao.atual().hora());
  const servAgora = rel.agora();
  confere(`${ID}2 o relógio de parede de uma página pula +60 s depois da calibração: a hora da sessão continua a do servidor (diferença ${Math.round(horaDepois2 - servAgora)} ms)`,
    calibrou && desvio === 60000 && Math.abs(horaDepois2 - servAgora) < 3000 && horaDepois2 > horaDepois, { calibrou, desvio, dif: horaDepois2 - servAgora });

  /* Q3 um técnico some (a página 3 escondida): ausente para os outros, passa sozinho, não gasta; volta ao controle */
  await ateNode(() => { const v = vivoServ(cod); return v && v.seq >= 6; }, real(600000), 200);
  const t3 = 3, cx3 = () => Lx.norm(vivoServ(cod), C.ctx).cx[t3][0];
  const caixaAntes = cx3(), dAntes = Lx.norm(vivoServ(cod), C.ctx).d;
  // (quem esconde a página não toca em nada: o piloto dela para junto)
  await pausaPiloto(P3, true);
  await P3.p.evaluate(() => window.__esconde(true));
  const aus = await ate(P1.p, () => TM.leilaoSessao.atual().ver().tecnicos[3].ausente, null, real(30000) + 10000);
  // o selo "Ausente" na folha Participantes do PC
  await clicaSel(P1, ".lei-sb[aria-label='Participantes']");
  await ate(P1.p, () => !!document.querySelector(".lei-folha .lei-part[data-uid='uidQ3'], .lei-part[data-uid='uidQ3']"), null, 5000);
  const selo = await P1.p.evaluate(() => { const x = document.querySelector(".lei-part[data-uid='uidQ3']"); return x ? x.innerText.replace(/\s+/g, " ") : null; });
  await P1.p.keyboard.press("Escape");
  const seqSome = vivoServ(cod).seq, nFechos = C.fechos.length;
  await ateNode(() => vivoServ(cod).seq >= seqSome + 4, real(400000), 100);
  const vSome = Lx.norm(vivoServ(cod), C.ctx);
  // cada lote fechado com ele fora (o estado logo antes de fechar, visto pelo servidor): ele passou, não podia dar lance,
  // ou foi o passe dele (dado por outro aparelho) que fechou o lote
  const lotesSome = C.fechos.slice(nFechos).map(x => x.a).filter(a => a.seq > seqSome);
  const passou3 = a => {
    if (a.p.charAt(t3) === "1" || !Lx.pode(a, C.ctx, t3).pode) return true;
    const a2 = Object.assign({}, a, { p: a.p.slice(0, t3) + "1" + a.p.slice(t3 + 1) });
    return Lx.todosPassaram(a2, C.ctx) && !Lx.todosPassaram(a, C.ctx);
  };
  const naoGastou = cx3() === caixaAntes && vSome.d.split("").every((x, i) => x !== Lx.letra(t3) || dAntes.charAt(i) === x);
  const passouSo = lotesSome.length >= 2 && lotesSome.every(passou3);
  await P3.p.evaluate(() => window.__esconde(false));
  await pausaPiloto(P3, false);
  const voltou = await ate(P1.p, () => !TM.leilaoSessao.atual().ver().tecnicos[3].ausente, null, real(30000) + 10000);
  const redeOk = await ate(P3.p, () => TM.leilaoSessao.atual().ver().rede === "ok", null, 20000);
  const acoes0 = (await piloto(P3)).acoes;
  const agiu = await ate(P3.p, n => window.__lt.estado().acoes > n, acoes0, real(300000) + 10000);
  confere(`${ID}3 um técnico some (a página escondida): "Ausente" para os outros, passa sozinho em cada lote (${lotesSome.length} lotes) sem gastar e, de volta, age de novo`,
    aus && /Ausente/.test(selo || "") && naoGastou && passouSo && voltou && redeOk && agiu,
    { aus, selo, naoGastou, passouSo, lotes: lotesSome.map(v => v.p), voltou, redeOk, agiu });

  /* Q4 passar o clube: a pessoa da página 2 troca de aparelho (outra conta pede pelo código); o dono passa pela tela */
  const P2b = await aparelho("Quatro-2b", "uidQ2novo", { w: 390, h: 844, toque: true, lat: 12 });
  await conta(P2b);
  const errN = await entrarPelaTela(P2b, cod);
  const pediuN = await ate(P2b.p, () => { const S = TM.leilaoSessao.atual(); return S && S.pedido && S.pedido.depois; }, null, 15000);
  await pausaPiloto(P0, true);
  await P0.p.evaluate(() => TM.ui.go("leilao-saguao"));
  const viuP = await ate(P0.p, () => !!document.querySelector(".lei-pedido-depois[data-uid='uidQ2novo']"), null, 15000);
  await P0.p.evaluate(() => [...document.querySelectorAll(".lei-pedido-depois[data-uid='uidQ2novo'] button")].find(b => /Passar o clube de Quatro-2/.test(b.textContent)).click());
  const confirmou = await confirmaSheet(P0, "Passar o clube");
  const passou = await ate(P2b.p, () => { const S = TM.leilaoSessao.atual(); return S && S.eu === 2 && !S.pedido; }, null, 20000);
  const velhoOlha = await ate(P2.p, () => { const S = TM.leilaoSessao.atual(); return S && S.eu === -1; }, null, 20000);
  await P0.p.evaluate(() => TM.ui.go("leilao-lote"));
  await pausaPiloto(P0, false);
  await P2.p.evaluate(() => window.__lt.parar());
  await P2b.p.evaluate(() => TM.ui.go("leilao-lote"));
  await pilotar(P2b, "api");
  const s4 = sala(cod);
  const agiuN = await ate(P2b.p, () => window.__lt.estado().acoes > 0, null, real(300000) + 10000);
  confere(`${ID}4 passar o clube: o pedido de quem trocou de aparelho aparece ao dono, que passa pela tela; a conta nova age pelo clube e a velha só olha`,
    errN == null && pediuN && viuP && confirmou && passou && velhoOlha && s4.ordem[2] === "uidQ2novo" && s4.tec.uidQ2novo && !s4.tec.uidQ2 && agiuN,
    { errN, pediuN, viuP, confirmou, passou, velhoOlha, ordem: s4.ordem, agiuN });
  await P2.cx.close().catch(() => {});

  /* Q5 a 1ª página (o dono) cai na metade: as outras seguem, os bots também */
  await ateNode(() => vivoServ(cod).seq >= Math.floor(C.ctx.fila.length / 2), real(1200000), 300);
  const horaQueda = rel.agora(), cxDono = Lx.norm(vivoServ(cod), C.ctx).cx[0][0], dDono = Lx.norm(vivoServ(cod), C.ctx).d;
  await P0.cx.close().catch(() => {});
  const vivos = [P1, P2b, P3];
  const acabou = await ateOFim(cod, vivos, real(78 * 40000) + 90000);
  const vF = Lx.norm(vivoServ(cod), C.ctx);
  const botsDepois = C.compras.filter(x => x.hora > horaQueda && x.t >= 4).length + Object.keys(C.ultLance).filter(t => +t >= 4 && C.ultLance[t] > horaQueda).length;
  const donoParado = vF.cx[0][0] === cxDono && vF.d.split("").every((x, i) => x !== Lx.letra(0) || dDono.charAt(i) === x);
  confere(`${ID}5 a 1ª página (o dono) cai na metade: as outras levam o leilão até o fim, os bots seguem comprando (${botsDepois} compras e lances depois da queda) e quem caiu não gasta mais`,
    acabou && botsDepois > 0 && donoParado, { acabou, botsDepois, donoParado, seq: vF.seq });
  const fim = await fimIgual(ID, vivos, cod);
  confere(`${ID}6 o mesmo fim nas 3 páginas que ficaram e no servidor (com os relógios +5 s, −5 s e o pulo de +60 s)`, acabou && fim.ok, fim.info);
  confOk(`${ID}6b`, cod);
  for (const ap of vivos) await ap.cx.close().catch(() => {});
}

/* ====================================================================================================== */
async function casoOito() {
  const ID = "O";
  const TAM = [[390, 844, true], [1280, 800, false], [844, 390, true], [360, 740, true], [430, 932, true], [820, 1180, true], [1440, 900, false], [1920, 1080, false]];
  const aps = [];
  for (let k = 0; k < 8; k++) aps.push(await aparelho("Oito-" + k, "uidO" + k, { w: TAM[k][0], h: TAM[k][1], toque: TAM[k][2], lat: [4, 6, 8, 10, 12, 14, 16, 20][k], desvio: (k % 3 - 1) * 5000 }));
  const b0 = aps.map(ap => banco.bytes(ap.p).desce);
  const { cod, r } = await salaPelaApi(aps, { liga: "de", vagas: 8, bots: 0, tempo: 10 });
  const C = vigia(cod);
  confere(`${ID}1 8 páginas na sala e o Começar: 104 lotes, o mesmo vivo em todas`, r && r.ok && C.ctx && C.ctx.fila.length === 104, { r });
  // as duas primeiras pela tela (na aba Leilão); as outras pela API, fora das telas da sala (o online não para)
  for (let k = 0; k < 8; k++) await aps[k].p.evaluate(k => TM.ui.go(k < 2 ? "leilao-lote" : "modes"), k);
  for (let k = 0; k < 8; k++) await pilotar(aps[k], k < 2 ? "tela" : "api");
  const acabou = await ateOFim(cod, aps, real(104 * 40000) + 120000);
  const fim = await fimIgual(ID, aps, cod);
  confere(`${ID}2 o leilão de 8 até o fim: o mesmo vivo, as mesmas compras e caixas nas 8 páginas e no servidor`, acabou && fim.ok, fim.info);
  confOk(`${ID}2b`, cod);
  const kb = aps.map((ap, k) => (banco.bytes(ap.p).desce - b0[k]) / 1024);
  const max = Math.max(...kb), tot = kb.reduce((a, b) => a + b, 0);
  confere(`${ID}3 os bytes baixados do banco por página no leilão de 8 com 104 lotes: ${kb.map(x => x.toFixed(0)).join(" · ")} KB (o maior ${(max / 1024).toFixed(2)} MB; ${(tot / 1024).toFixed(1)} MB no total; teto 3 MB por página)`,
    acabou && max > 50 && max < 3 * 1024, { kb });
  for (const ap of aps) await ap.cx.close().catch(() => {});
}

/* ====================================================================================================== */
/* telas (T1–T8): o que a revisão do PR 2 achou nas telas, com nomes de 16 letras (o máximo do TM.net): o nome nunca corta
   no pedido nem nos participantes (o número desce), os botões do pedido descem pela largura da COLUNA, o foco pelo teclado
   depois de Aceitar, o Salvar do clube apagado sem mudança, "Atualizando…" (não "Sem conexão") na barra, o "lidera" do
   placar sempre à vista e a sala congelada como "parada" na Entrada e nas Minhas salas */
async function casoTelas() {
  const ID = "T";
  const NOMES = ["Mariana Oliveira", "Guilherme Santos", "Beatriz Carvalho"];
  const Dn = await aparelho(NOMES[0], "uidTm", { w: 820, h: 1180, toque: true });
  const G1 = await aparelho(NOMES[1], "uidTg", { w: 390, h: 844, toque: true });
  const G2 = await aparelho(NOMES[2], "uidTb", { w: 1280, h: 800 });
  for (const ap of [Dn, G1, G2]) await conta(ap);
  // sem bots: no T6 ninguém passa o lance do convidado na frente
  const cod = await Dn.p.evaluate(() => TM.leilaoSessao.criarSala({ liga: "br", vagas: 3, bots: 0, tempo: 10 }).then(S => S.codigo));
  await Dn.p.evaluate(() => TM.ui.go("leilao-saguao"));
  for (const ap of [G1, G2]) await ap.p.evaluate(c => TM.leilaoSessao.entrar(c).then(() => TM.ui.go("leilao-saguao")), cod);
  await ate(Dn.p, () => document.querySelectorAll(".lei-pedido").length === 2, null, 30000);
  // a medida do corte: o texto que não cabe na caixa (scrollWidth > clientWidth)
  const cortes = (ap, sel) => ap.p.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null)
    .map(e => ({ txt: e.textContent, sw: e.scrollWidth, cw: e.clientWidth })).filter(x => x.sw > x.cw + 1), sel);
  async function emTamanhos(ap, tams, fn) {
    const vp0 = ap.p.viewportSize(), out = [];
    for (const [w, h] of tams) { await ap.p.setViewportSize({ width: w, height: h }); await espera(260); out.push(...(await fn()).map(x => Object.assign({ tela: w + "x" + h }, x))); }
    await ap.p.setViewportSize(vp0); await espera(150);
    return out;
  }
  const OITO = [[360, 740], [390, 844], [430, 932], [844, 390], [820, 1180], [1280, 800], [1440, 900], [1920, 1080]];

  /* T1 os pedidos: o nome inteiro à vista em todos os tamanhos (antes, em 820×1180 e 844×390, só "M.") */
  const c1 = await emTamanhos(Dn, OITO, () => cortes(Dn, ".lei-pedido .lei-part-n"));
  const nPed = await Dn.p.evaluate(() => [...document.querySelectorAll(".lei-pedido .lei-part-n")].map(e => e.textContent));
  confere(`${ID}1 os pedidos de entrada com nomes de 16 letras: o nome inteiro à vista nos 8 tamanhos (o número desce; os botões descem pela largura da coluna)`,
    nPed.length === 2 && nPed.every(n => NOMES.includes(n)) && !c1.length, { nPed, cortes: c1.slice(0, 6) });

  /* T2 o foco pelo teclado depois de Aceitar: vai ao Aceitar do próximo pedido (antes caía no começo da página) */
  await Dn.p.evaluate(() => { const b = [...document.querySelectorAll(".lei-pedido button")].find(x => /^Aceitar/.test(x.getAttribute("aria-label") || "")); b.focus(); });
  const antes = await Dn.p.evaluate(() => document.activeElement && document.activeElement.getAttribute("aria-label"));
  await Dn.p.keyboard.press("Enter");
  await ate(Dn.p, () => document.querySelectorAll(".lei-pedido").length === 1, null, 20000);
  await espera(400);
  const depois = await Dn.p.evaluate(() => { const a = document.activeElement; return a ? (a.tagName + " " + (a.getAttribute("aria-label") || a.textContent.trim().slice(0, 30))) : null; });
  confere(`${ID}2 o foco pelo teclado depois de Aceitar vai ao Aceitar do próximo pedido (não ao começo da página)`,
    /^Aceitar/.test(antes || "") && /^BUTTON Aceitar/.test(depois || "") && !(depois || "").includes(antes), { antes, depois });
  // o 2º pedido também: sem mais pedidos, o foco fica no rótulo da seção
  await Dn.p.keyboard.press("Enter");
  await ate(Dn.p, () => !document.querySelector(".lei-pedido") && TM.leilaoSessao.atual().ver().tecnicos.length === 3, null, 20000);
  await espera(400);
  const depois2 = await Dn.p.evaluate(() => { const a = document.activeElement; return a ? a.tagName + "." + a.className : null; });
  confere(`${ID}2b sem mais pedidos, o foco fica no rótulo "Pedidos de entrada" (não no BODY)`, /lei-rotulo/.test(depois2 || ""), { depois2 });
  // (com o foco perdido o Enter não aceitou: aceita pela API para os itens seguintes valerem sozinhos)
  await Dn.p.evaluate(u => { const V = TM.leilaoSessao.atual().ver(); if (V.saguao.pedidos.some(p => p.uid === u)) return TM.leilaoSessao.atual().aceitar(u); }, "uidTb");
  await ate(G2.p, () => { const S = TM.leilaoSessao.atual(); return S && S.eu >= 0 && !S.pedido; }, null, 20000);

  /* T3 os participantes com nomes de 16 letras: inteiros nos 8 tamanhos, no dono e nos convidados (também com o Pronto) */
  await G1.p.evaluate(() => TM.leilaoSessao.atual().pronto(true));
  await ate(Dn.p, () => TM.leilaoSessao.atual().ver().saguao.prontos === 2, null, 20000);
  await ate(G1.p, () => document.querySelectorAll(".lei-part").length === 3, null, 20000);
  const c3 = (await emTamanhos(Dn, OITO, () => cortes(Dn, ".lei-part .lei-part-n"))).concat(await emTamanhos(G1, OITO, () => cortes(G1, ".lei-part .lei-part-n")));
  const nsT = await nadaSobreNada(Dn, "telas-saguao-dono", () => !!document.querySelector(".lei-sagbar"));
  confere(`${ID}3 os participantes com nomes de 16 letras: o nome inteiro nos 8 tamanhos (o dono e o convidado pronto) e nada sobre nada`,
    !c3.length && !nsT.ruins.length, { cortes: c3.slice(0, 6), ruins: nsT.ruins.slice(0, 3) });

  /* T4 o Salvar do clube: apagado ao abrir o saguão, aceso depois de mudar a sigla, apagado de novo depois de salvo */
  await G2.p.evaluate(() => TM.ui.go("leilao-saguao"));
  const temSalvar = await ate(G2.p, () => !!document.querySelector(".lei-salvar"), null, 20000);
  if (!temSalvar) confere(`${ID}4 o Salvar do clube aparece no saguão do convidado`, false, await G2.p.evaluate(() => ({ rota: TM.ui.current(), txt: document.body.innerText.slice(0, 300) })));
  await espera(300);
  const s0 = await G2.p.evaluate(() => document.querySelector(".lei-salvar").disabled);
  await G2.p.evaluate(() => { const i = document.querySelector(".lei-campo-sigla"); i.value = "BCX"; i.dispatchEvent(new Event("input", { bubbles: true })); });
  const s1 = await G2.p.evaluate(() => document.querySelector(".lei-salvar").disabled);
  await G2.p.evaluate(() => document.querySelector(".lei-salvar").click());
  const salvo = await ateNode(() => { const s = sala(cod); return !!(s && s.tec.uidTb && s.tec.uidTb.clube.sigla === "BCX"); }, 20000);
  await ate(G2.p, () => document.querySelector(".lei-salvar") && document.querySelector(".lei-salvar").disabled, null, 10000);
  const s2 = await G2.p.evaluate(() => document.querySelector(".lei-salvar").disabled);
  confere(`${ID}4 o Salvar do clube: apagado ao abrir, aceso depois de mudar a sigla e apagado de novo depois de salvo (antes ficava sempre aceso)`,
    s0 === true && s1 === false && salvo && s2 === true, { s0, s1, salvo, s2 });

  /* T5 a barra do saguão com a sala "Atualizando…" (a volta da página, o ack a caminho): o motivo é "Atualizando a sala…" */
  await G1.p.evaluate(() => { const S = TM.leilaoSessao.atual(); S._estadoBate = "atualizando"; S._notificar(); });
  await espera(300);
  const barra5 = await G1.p.evaluate(() => ({ faixa: (document.querySelector(".lei-aviso-sala") || {}).textContent || "", msg: (document.querySelector(".lei-sagbar-msg") || {}).textContent || "" }));
  await G1.p.evaluate(() => { const S = TM.leilaoSessao.atual(); S._bateEmVoo = false; S._bater(); });
  await ate(G1.p, () => TM.leilaoSessao.atual().ver().rede === "ok", null, 20000);
  confere(`${ID}5 a sala "Atualizando…": a barra do saguão diz "Atualizando a sala…" (não "Sem conexão")`,
    /Atualizando a sala/.test(barra5.msg) && !/Sem conexão/.test(barra5.msg), barra5);

  /* T6 o "lidera" do placar sempre à vista com o nome de 16 letras (360×740) */
  await ate(G2.p, () => !TM.leilaoSessao.atual().pedido, null, 10000);
  await G2.p.evaluate(() => TM.leilaoSessao.atual().pronto(true));
  await ate(Dn.p, () => TM.leilaoSessao.atual().ver().saguao.podeComecar, null, 30000);
  await Dn.p.evaluate(() => TM.leilaoSessao.atual().comecar());
  await ateNode(async () => { const vs = await Promise.all([Dn, G1, G2].map(ver)); return vs.every(V => V && V.vivo && V.estado === "leilao"); }, 30000);
  vigia(cod);
  await Dn.p.setViewportSize({ width: 360, height: 740 });
  await Dn.p.evaluate(() => TM.ui.go("leilao-lote"));
  await ate(G1.p, () => { const V = TM.leilaoSessao.atual().ver(); return V.botoes && V.botoes["+1"].pode && V.lote && V.lote.restante > 6000; }, null, real(60000) + 10000);
  await G1.p.evaluate(() => TM.leilaoSessao.atual().lance("+1"));
  const lidera = await ate(Dn.p, n => { const x = document.querySelector(".lei-lider-nome"); return x && x.textContent === n; }, NOMES[1], 20000);
  const p6 = await Dn.p.evaluate(() => {
    const v = document.querySelector(".lei-lider-v"), pl = document.querySelector(".lei-placar");
    if (!v || !pl) return null;
    const a = v.getBoundingClientRect(), b = pl.getBoundingClientRect();
    return { txt: v.textContent, dentro: a.width > 4 && a.left >= b.left - 1 && a.right <= b.right + 1, sw: v.scrollWidth, cw: v.clientWidth };
  });
  confere(`${ID}6 o placar com o líder de 16 letras em 360×740: "lidera" inteiro à vista (o nome encolhe)`, lidera && p6 && p6.txt === "lidera" && p6.dentro && p6.sw <= p6.cw + 1, p6);

  /* T7–T8 a sala congelada (o vivo mexido no servidor): "Sala parada" na Entrada e "Parada" nas Minhas salas */
  const vv = vivoServ(cod); vv.cx[0][0] += 50; banco.gravar("leiloes/" + cod + "/vivo", vv);
  await ate(G1.p, () => !!TM.leilaoSessao.atual().ver().alterada, null, 20000);
  await G1.p.evaluate(() => TM.ui.go("leilao"));
  await ate(G1.p, () => !!document.querySelector(".lei-andamento"), null, 20000);
  await espera(300);
  const t7 = await G1.p.evaluate(() => ({ cartao: document.querySelector(".lei-andamento").innerText.replace(/\s+/g, " "), linha: [...document.querySelectorAll(".lei-sala .lei-sala-s")].map(e => e.textContent) }));
  confere(`${ID}7 a sala congelada aparece "Sala parada" na Entrada (não "Leilão em andamento")`, /Sala parada/i.test(t7.cartao) && /alterada fora das regras/.test(t7.cartao) && !/em andamento/i.test(t7.cartao), t7);
  const c8 = await emTamanhos(G1, [[360, 740], [390, 844]], () => cortes(G1, ".lei-sala .lei-sala-s, .lei-sala .lei-sala-t, .lei-andamento .lei-sala-s"));
  confere(`${ID}8 as Minhas salas: a linha da sala congelada começa por "Parada" e não corta em 360×740 e 390×844`, t7.linha.some(x => /^Parada/.test(x)) && !c8.length, { linha: t7.linha, cortes: c8 });
  for (const ap of [Dn, G1, G2]) await ap.p.evaluate(() => { const S = TM.leilaoSessao.atual(); if (S) S.parar(); }).catch(() => {});
  for (const ap of [Dn, G1, G2]) await ap.cx.close().catch(() => {});
}

/* ====================================================================================================== */
try {
  if (caso("telas")) await casoTelas();
  if (caso("dois")) await casoDois();
  if (caso("quatro")) await casoQuatro();
  if (caso("oito")) await casoOito();
} catch (e) {
  confere("exceção no teste", false, String(e && e.stack || e).slice(0, 1500));
}
confere("G0 a guarda do Firebase de verdade funciona: um pedido e um WebSocket de prova a *.firebaseio.com são barrados e contados", !!(guarda && guarda.pedido && guarda.ws), guarda);
confere(`G1 nenhuma página falou com o Firebase de verdade (${aparelhos.length} páginas; o SDK do gstatic é o falso; outros endereços de fora: ${[...externos].join(", ") || "nenhum"})`, !firebaseReal.filter(x => !/prova-da-guarda/.test(x)).length, firebaseReal.filter(x => !/prova-da-guarda/.test(x)).slice(0, 6));
const errosPag = [];
for (const ap of aparelhos) { const x = await ap.p.evaluate(() => window.__errosPagina || []).catch(() => []); x.forEach(m => errosPag.push(ap.nome + ": " + m)); }
confere("G2 nenhum erro no console nem na página", !erros.length && !errosPag.length, erros.concat(errosPag).slice(0, 8));
await nav.close().catch(() => {});
if (srv) await srv.fechar();
console.log(`${falhas.length ? "REPROVOU" : "PASSOU"}: ${oks.length} de ${oks.length + falhas.length} itens em ${((performance.now() - t0) / 1000).toFixed(1)} s (fator ${FATOR}; prints em ${PASTA})`);
process.exit(falhas.length ? 1 : 0);
