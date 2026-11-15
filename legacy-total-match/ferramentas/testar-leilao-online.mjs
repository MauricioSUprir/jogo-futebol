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
     dois    (D1–D14) a sala pela tela: criar sala (o formato Pontos + mata-mata), o código escondido com o olho e o QR,
             Copiar convite, Compartilhar só com navigator.share; o pedido pelo link ?leilao= e aceitar; o pedido pelo
             código e recusar (não pede de novo); as recusas na tela (código errado, sala cheia, edição, regras
             diferentes); Pronto e Começar; nada sobre nada no Saguão (dono e convidado) e no Leilão em 360×740, 844×390
             e 1280×800, no escuro e no claro; o leilão inteiro pelos botões nas duas páginas; dois lances no mesmo
             instante (um vence, o outro vê "Alguém chegou antes"); o ack perdido ("Conferindo…" e o resultado certo); o
             lance velho guardado (recusado); recarregar no meio (pelo ?leilao= e pelas Minhas salas, depois do deploy:
             versaoTM diferente, quem é da sala volta); o fim igual nas duas e no servidor; a escalação pela tela e o
             campeonato misto com 2 (a fase de pontos e a Final de amigo contra amigo simuladas ao abrir a rodada, a
             mesma tabela e o mesmo campeão nas duas, o Ver o jogo no 2D sem pausa)
     quatro  (Q1–Q15) 4 páginas + 2 bots: os relógios +5 s e −5 s, o pulo de +60 s depois da calibração, um técnico que
             some (a página escondida: ausente, passa sozinho, não gasta, volta), passar o clube (a conta nova pelo código,
             o dono pela tela), a 1ª página cai no meio (as outras seguem, os bots também), o mesmo fim em todas; depois
             o campeonato de PONTOS CORRIDOS com 6 pela tela: a escalação, o dono que volta pelo link, o Simular partida de
             cada um e o 2D sem pausa com o placar gravado, o prazo de 2 min com o relógio da página +5 s (vence e o jogo é
             simulado pelo servidor), a página que cai no meio (as outras seguem; o prazo dela para e volta), recarregar,
             o dono "Simular os pendentes" pela tela, a mesma tabela e o mesmo campeão nas 4 e no servidor, nada sobre nada
             na aba Campeonato e no fim
     oito    (O1–O8) 8 páginas, 104 lotes: o mesmo vivo, compras e caixas em todas e no servidor; os BYTES baixados do
             banco por página; depois o MATA-MATA com 8 (a escalação pela tela em duas, pela API nas outras; os jogos de
             amigo contra amigo simulados ao abrir a rodada), a mesma chave e o mesmo campeão nas 8 e no servidor, o Ver o
             jogo no 2D, nada sobre nada no fim e os bytes do campeonato somados aos do leilão
     G0 a guarda pega (um pedido e um WebSocket de prova a *.firebaseio.com são barrados e contados) · G1 nenhuma página
     falou com o Firebase de verdade · G2 nenhum erro no console nem na página · G3 as regras opcionais não recusariam
     nenhuma gravação honesta das páginas
   Em todo caso o servidor guarda a história de cada nó jogos/{id} (como o bloco KO do testar-leilao.mjs): cada jogo
   reservado e gravado UMA vez, com a mesma trava; o reservado pelo prazo só com a hora do SERVIDOR além do prazo e 2 min
   correndo. E as regras opcionais (o .validate do LEIA-ME-leilao.md, ferramentas/lib/regras-leilao.mjs) conferem cada
   gravação das páginas sem recusar nada (G3: o fluxo honesto não pode ser recusado).
   O par do Online 3D (PR 5) entra aqui no PR dele.
   Uma linha por item; o código de saída é 1 se algum reprovar (no CI, um job por caso).
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
const { avaliadorRegras } = await import(pathToFileURL(path.join(RAIZ, "ferramentas/lib/regras-leilao.mjs")).href);

/* ---------- o TM.leilao e o TM.leilaoCamp em Node (as contas do servidor: o fim do lote, o "todos passaram", os times;
   o texto canônico dos jogos) ---------- */
const { Lx, LCx } = (() => {
  const ctx = { console, Math, Date, JSON };
  ctx.window = ctx; ctx.TM = {};
  vm.createContext(ctx);
  for (const f of ["js/rng.js", "js/leilao.js", "js/leilao-camp.js"]) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), "utf8"), ctx, { filename: f });
  return { Lx: ctx.TM.leilao, LCx: ctx.TM.leilaoCamp };
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
  const vivos = [], jogosToca = [];
  for (const [ps] of itens) {
    if (ps.length === 3 && ps[0] === "leiloes" && ps[2] === "vivo" && conf[ps[1]]) vivos.push(ps[1]);
    if (ps[0] === "leiloes" && HIST[ps[1]] && (ps.length <= 2 || ps[2] === "jogos")) jogosToca.push(ps);
  }
  const antes = vivos.map(c => banco.ler("leiloes/" + c + "/vivo"));
  escreveOrig(itens);
  const hora = rel.agora();
  historiaJogos(jogosToca, hora);
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
// a história de cada jogo do campeonato no servidor: a hora do servidor de cada mudança do nó jogos/{id} (como o bloco KO do
// testar-leilao.mjs)
const HIST = {};   // código → { ult: { id: canon }, log: { id: [{ hora, j }] } }
function historiaJogos(toca, hora) {
  for (const ps of toca) {
    const H = HIST[ps[1]], base = "leiloes/" + ps[1] + "/jogos";
    const ids = ps.length >= 4 ? [ps[3]] : [...new Set(Object.keys(banco.ler(base) || {}).concat(Object.keys(H.ult)))];
    for (const id of ids) {
      const j = banco.ler(base + "/" + id), c = LCx.canon(j);
      if (H.ult[id] === c) continue;
      H.ult[id] = c; (H.log[id] = H.log[id] || []).push({ hora, j });
    }
  }
}
// as regras opcionais (o .validate do LEIA-ME) avaliadas em cada gravação das páginas, sem recusar: o fluxo honesto não pode
// ser recusado por elas (G3); as salas que o próprio teste adultera ficam fora da conta. Esperada: o batimento (ou a
// presença) que estava a caminho quando a conta deixou de ser da sala (o clube passado a outro aparelho no Q4) — a regra o
// recusa de propósito e a sessão não toma a recusa por queda de conexão (o caso "passar" do bloco KO do testar-leilao.mjs)
const confereRegras = avaliadorRegras(path.join(RAIZ, "firebase/regras-leilao-validate.json"));
const REGRAS = { gravacoes: 0, recusas: [], esperadas: [], adulteradas: new Set() };
banco.negar = (op, caminho, valor, C) => {
  const ps = String(caminho).split("/").filter(Boolean);
  if (ps[0] !== "leiloes") return false;
  REGRAS.gravacoes++;
  const f = confereRegras(banco.raiz, ps, valor, banco.relogio(), C ? C.uid : null);
  if (!f.length || REGRAS.adulteradas.has(ps[1])) return false;
  const tec = banco.ler("leiloes/" + ps[1] + "/sala/tec") || {};
  const x = { op, caminho, f: f.slice(0, 2), valor: JSON.stringify(valor).slice(0, 200) };
  if ((ps[2] === "bate" || ps[2] === "pres") && ps[3] && !tec[ps[3]]) REGRAS.esperadas.push(x);
  else REGRAS.recusas.push(x);
  return false;
};
function vigia(codigo) {
  if (!HIST[codigo]) HIST[codigo] = { ult: {}, log: {} };
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

/* ---------- nada sobre nada (o critério do testar-leilao.mjs --tela, com as peças do saguão e do campeonato) ---------- */
const sobreposicao = p => p.evaluate(() => {
  const sel = "button, a[href], [role=button], input, select, .ut-card, .lei-placar, .lei-meu, .lei-bloco, .next-match, .lei-sala, .lei-caixa, .lei-part, .lei-pedido, .lei-etq, .qr-box, .lei-jogo, .lei-ch-jogo, .md-poster, .lei-cl, .lei-art-l";
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
  // no campeonato: a tabela não rola de lado dentro da caixa e os escudos são os desenhados (nenhuma imagem)
  const tab = document.querySelector(".lei-tab-rola");
  return { n: els.length, sobre: pares, encostam, saem, fora, rolaLado: document.documentElement.scrollWidth > larg + 1, atras, barra: !!barra,
    tabelaRola: tab ? tab.scrollWidth > tab.clientWidth + 1 : false, escudosReais: document.querySelectorAll(".lei-corpo-camp img").length };
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
      const r = { tela: `${rotulo} ${tema === "light" ? "claro" : "escuro"} ${w}x${h}`, n: s.n, barra: s.barra, sobre: s.sobre.slice(0, 4), encostam: s.encostam.slice(0, 4), saem: s.saem.slice(0, 4), fora: s.fora.slice(0, 4), rolaLado: s.rolaLado, atras: s.atras,
        tabelaRola: s.tabelaRola, escudosReais: s.escudosReais };
      medidas.push(r);
      if (r.sobre.length || r.encostam.length || r.saem.length || r.fora.length || r.rolaLado || r.atras || r.tabelaRola || r.escudosReais) ruins.push(r);
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


/* ---------- o campeonato (PR 3): o que todas as páginas veem, a história no servidor, o 2D e o piloto pela tela ---------- */
// o que todo aparelho tem de ver igual (a vista do campeonato, como o resumo do bloco KO) e o texto canônico dos nós dos jogos
// que ele tem (têm de ser os do servidor)
const resumoCamp = ap => ap.p.evaluate(() => {
  const S = TM.leilaoSessao.atual(); if (!S) return null;
  const V = S.ver(), c = V.camp, jogos = {};
  Object.keys(S.jogos || {}).sort().forEach(k => { jogos[k] = TM.leilaoCamp.canon(S.jogos[k]); });
  if (!c) return { estado: V.estado, alterada: V.alterada || null, fim: false, r: null, jogos };
  return { estado: V.estado, alterada: V.alterada || null, alteradaJogo: c.alteradaJogo || null, fim: !!c.fim, rodada: c.rodada ? c.rodada.n : null, campeao: c.campeao,
    r: JSON.stringify({ r: c.rodadas.map(R => R.jogos.map(g => [g.id, g.a, g.b, g.e, g.placar, g.venc])), t: c.tabela && c.tabela.map(x => [x.t, x.pts, x.sg, x.gp]),
      c: c.campeao, cl: c.classificacao, a: c.artilharia.slice(0, 5).map(x => [x.id, x.gols]), f: c.fim }),
    jogos };
}).catch(() => null);
function jogosServ(cod) { const j = banco.ler("leiloes/" + cod + "/jogos") || {}, o = {}; Object.keys(j).sort().forEach(k => { o[k] = LCx.canon(j[k]); }); return o; }
// espera o fim do campeonato com a MESMA vista em todas as páginas e os mesmos nós dos jogos que o servidor guarda
async function campIgual(aps, cod, msReal = 40000) {
  let ult = null;
  const ok = await ateNode(async () => {
    const rs = await Promise.all(aps.map(resumoCamp)), js = JSON.stringify(jogosServ(cod));
    ult = { rs, js };
    return rs.every(r => r && r.fim && r.estado === "fim" && !r.alterada && r.r === rs[0].r && JSON.stringify(r.jogos) === js);
  }, msReal, 250);
  const info = ult && { estados: ult.rs.map(r => r && [r.estado, r.fim, r.alterada, r.alteradaJogo && JSON.stringify(r.alteradaJogo)]), iguais: ult.rs.map(r => !!(r && r.r === ult.rs[0].r)),
    jogosDoServidor: ult.rs.map(r => !!(r && JSON.stringify(r.jogos) === ult.js)), n: Object.keys(JSON.parse(ult.js)).length, campeao: ult.rs[0] && ult.rs[0].campeao };
  return { ok, info, vista: ult && ult.rs[0] && ult.rs[0].r };
}
// a história de cada jogo no servidor: uma reserva, um resultado (o último) com a mesma trava, os mesmos times e as mesmas
// escalações; o reservado pelo prazo só com o prazo vencido pela hora do servidor e com 2 min correndo; conta os motivos e
// as pausas do prazo
function confereHist(cod) {
  const H = HIST[cod], jogos = banco.ler("leiloes/" + cod + "/jogos") || {}, conta = {}, ruins = [], prazos = [];
  for (const id of Object.keys(jogos)) {
    const L = H.log[id] || [], res = L.filter(x => x.j && x.j.e === "reservado"), fe = L.filter(x => x.j && x.j.e === "feito");
    if (res.length !== 1 || fe.length !== 1 || !(L[L.length - 1].j && L[L.length - 1].j.e === "feito")) { ruins.push({ id, reservas: res.length, feitos: fe.length, passos: L.map(x => x.j && x.j.e) }); continue; }
    const jr = res[0].j, jf = fe[0].j;
    if (jf.trava !== jr.trava || LCx.canon(jf.esc) !== LCx.canon(jr.esc) || LCx.canon(jf.ab) !== LCx.canon(jr.ab) || jf.motivo !== jr.motivo) ruins.push({ id, trava: [jr.trava, jf.trava] });
    conta[jr.motivo] = (conta[jr.motivo] || 0) + 1;
    const k = L.indexOf(res[0]);
    let corre = 0;
    for (let i = 0; i < k; i++) if (L[i].j && L[i].j.e === "aberto" && !L[i].j.parado) corre += L[i + 1].hora - L[i].hora;
    if (L.slice(0, k).some(x => x.j && x.j.e === "aberto" && x.j.parado)) conta.pausas = (conta.pausas || 0) + 1;
    if (jr.motivo === "prazo") {
      const ant = k > 0 ? L[k - 1].j : null, hora = res[0].hora;
      const venceu = !!(ant && ant.e === "aberto" && !ant.parado && ant.ini + ant.resta <= hora);
      prazos.push({ id, corre: Math.round(corre), atraso: ant && ant.ini != null ? Math.round(hora - ant.ini - ant.resta) : null });
      if (!venceu || corre < LCx.PRAZO) ruins.push({ id, prazo: { venceu, corre, falta: ant && ant.ini != null ? ant.ini + ant.resta - hora : null } });
    }
  }
  return { n: Object.keys(jogos).length, conta, ruins, prazos };
}
// o que a página registra para o campeonato: o 2D instantâneo (o placar dos 90' à mostra), os sorteios feitos pelo 2D (o
// resimRest da pausa: têm de ser 0; a conferência da sessão também simula, por outro caminho) e o estado de cada jogo na hora
// em que o 2D abre (o "Simular partida" grava ANTES de mostrar)
const vigiaCamp = ap => ap.p.evaluate(() => {
  if (window.__vigiaCamp) return;
  window.__vigiaCamp = true;
  TM.storage.saveSettings(Object.assign({}, TM.storage.settings(), { matchSpeed: "instantaneo" }));
  const o = TM.engine.simulate; window.__sims2d = 0;
  TM.engine.simulate = function () { if (/matchview\.js/.test(new Error().stack || "")) window.__sims2d++; return o.apply(this, arguments); };
  window.__aoAbrir = [];
  const go = TM.ui.go;
  TM.ui.go = function (r, prm) {
    if (r === "leilao-jogo") { const S = TM.leilaoSessao.atual(), j = S && S.jogos && prm && S.jogos[prm.id]; window.__aoAbrir.push({ id: prm && prm.id, e: j ? j.e : "?" }); }
    return go.apply(this, arguments);
  };
}).catch(() => {});
const VIGIA = new Map();   // aparelho → { sims2d, aoAbrir } juntados (recarregar zera os da página)
async function juntaVigia(ap) {
  const x = await ap.p.evaluate(() => ({ sims2d: window.__sims2d || 0, aoAbrir: (window.__aoAbrir || []).slice() })).catch(() => ({ sims2d: 0, aoAbrir: [] }));
  const A = VIGIA.get(ap) || { sims2d: 0, aoAbrir: [] };
  A.sims2d += x.sims2d; A.aoAbrir.push(...x.aoAbrir);
  VIGIA.set(ap, A);
  await ap.p.evaluate(() => { window.__sims2d = 0; window.__aoAbrir = []; }).catch(() => {});
  return A;
}
// no 2D do "Ver o jogo": o resultado GRAVADO no servidor, sem o botão de pausa, com os dois escudos desenhados; animando, o
// Pular; instantâneo, o placar dos 90' à mostra; depois Ver resultado → (a prorrogação com o gol de ouro → os pênaltis) → o
// Campeonato. vis junta o que viu e o que saiu errado
async function verNo2D(ap, cod, vis) {
  await espera(200);
  const g = await ap.p.evaluate(() => {
    const id = TM.leilaoTela.estado().jogo, S = TM.leilaoSessao.atual(), J = S && id ? S.partida(id) : null;
    return { id, rota: TM.ui.current(), res: J && { score: J.res.score, pror: J.res.pror ? J.res.pror.score : null, ouro: !!(J.res.pror && J.res.pror.ouro != null), pen: J.res.pen ? { score: J.res.pen.score, n: J.res.pen.kicks.length } : null },
      pausa: [...document.querySelectorAll(".screen.is-active button")].some(b => /Pausar/.test(b.textContent)), crest: document.querySelectorAll(".bc-crest.utx-escudo").length };
  }).catch(() => null);
  if (!g) return;
  const sj = g.id ? banco.ler(`leiloes/${cod}/jogos/${g.id}`) : null;
  if (g.rota === "leilao-jogo") {
    vis.jogos++;
    const f90 = await ap.p.evaluate(() => ({ animando: [...document.querySelectorAll(".screen.is-active .actions button")].some(x => /Pular/.test(x.textContent)),
      placar: (document.querySelector(".live-score") || {}).textContent, overlay: !!document.querySelector(".pause-overlay") })).catch(() => ({}));
    if (f90.animando) { vis.animados++; await ap.p.evaluate(() => { const b = [...document.querySelectorAll(".screen.is-active .actions button")].find(x => /Pular/.test(x.textContent)); if (b) b.click(); }).catch(() => {}); await espera(120); }
    else vis.placares++;
    const gravado = sj && sj.res && sj.res.score ? sj.res.score[0] + " - " + sj.res.score[1] : null;
    if (!g.res || !sj || sj.e !== "feito" || LCx.canon(g.res.score) !== LCx.canon(sj.res.score) || g.pausa || g.crest !== 2 || f90.overlay || (!f90.animando && f90.placar !== gravado))
      vis.ruins.push({ jogo: g.id, g, f90, gravado });
  }
  // Ver resultado → (a prorrogação → os pênaltis) → o Campeonato
  for (let k = 0; k < 8; k++) {
    const rota = await ap.p.evaluate(() => TM.ui.current()).catch(() => null);
    if (rota === "leilao-camp" || rota == null) break;
    if (rota === "prorrogacao") {
      vis.pror++;
      const pr = await ap.p.evaluate(() => ({ t: (document.querySelector(".pror-t") || {}).textContent, num: (document.querySelector(".pror-num") || {}).textContent, ouro: !!document.querySelector(".pror-ouro") })).catch(() => ({}));
      if (g.res && g.res.ouro) vis.ouro++;
      if (!/GOL DE OURO/.test(pr.t || "") || !g.res || !g.res.pror || pr.num !== g.res.pror[0] + " × " + g.res.pror[1] || pr.ouro !== g.res.ouro) vis.ruins.push({ jogo: g.id, pror: pr, res: g.res });
    }
    if (rota === "pen-shootout") {
      vis.pen++;
      await ate(ap.p, () => [...document.querySelectorAll(".screen.is-active button")].some(b => /^Continuar$/.test(b.textContent.trim())), null, 30000);
      const pk = await ap.p.evaluate(() => ({ n: document.querySelectorAll(".pk-kick").length, st: (document.querySelector(".pk-status") || {}).textContent || "", crest: document.querySelectorAll(".pk-crest.utx-escudo").length })).catch(() => ({}));
      if (!g.res || !g.res.pen || pk.n !== g.res.pen.n || pk.st.indexOf(g.res.pen.score[0] + "–" + g.res.pen.score[1]) < 0 || pk.crest !== 2) vis.ruins.push({ jogo: g.id, pen: pk, res: g.res });
    }
    await ap.p.evaluate(() => { const b = [...document.querySelectorAll(".screen.is-active button")].find(x => /Ver resultado|^Continuar$|Ir para os pênaltis/.test(x.textContent.trim())); if (b) b.click(); }).catch(() => {});
    await espera(220);
  }
}
const novoVis = () => ({ jogos: 0, animados: 0, placares: 0, pror: 0, ouro: 0, pen: 0, ruins: [] });
// o piloto do campeonato pela TELA (no Node, uma página por laço): na aba Campeonato toca em "Simular partida" quando a
// política deixa (pol.simula(meuJogo, estado) → true), passa pelo 2D que abre (verNo2D) e volta; fora da aba (a Escalação,
// a volta depois de recarregar) vai a ela. pausado: para na aba Campeonato (emPausa = parado lá); para no fim.
function pilotoCamp(ap, cod, pol = {}) {
  const P = { ap, parado: false, pausado: false, emPausa: false, cliques: [], vis: novoVis(), fim: false };
  P.promessa = (async () => {
    while (!P.parado) {
      const r = await ap.p.evaluate(() => {
        const S = TM.leilaoSessao.atual(), V = S && S.ver(), C = V && V.camp, mj = C && C.meuJogo, b = document.querySelector(".lei-simular");
        return { rota: TM.ui.current(), estado: V && V.estado, fim: !!(C && C.fim), rodada: C && C.rodada ? C.rodada.n : null,
          mj: mj && { id: mj.id, e: mj.e, contraBot: mj.contraBot, podeSimular: mj.podeSimular, rodada: mj.rodada },
          btn: !!(b && !b.disabled && b.offsetParent !== null) };
      }).catch(() => null);
      if (!r) { await espera(200); continue; }
      if (/^(leilao-jogo|prorrogacao|pen-shootout)$/.test(r.rota)) { P.emPausa = false; await verNo2D(ap, cod, P.vis); continue; }
      if (r.rota === "leilao-camp") {
        if (r.fim) { P.fim = true; break; }
        if (P.pausado) { P.emPausa = true; await espera(100); continue; }
        P.emPausa = false;
        if (r.btn && r.mj && (!pol.simula || pol.simula(r.mj, r))) {
          if (await clicaSel(ap, ".lei-simular")) {
            P.cliques.push({ id: r.mj.id, hora: rel.agora() });
            await ate(ap.p, () => TM.ui.current() !== "leilao-camp" || !document.querySelector(".lei-simular[aria-busy]"), null, 15000);
          }
        }
      } else if (r.estado === "camp" || r.estado === "fim") {
        P.emPausa = false;
        if (!P.pausado) await ap.p.evaluate(() => TM.ui.go("leilao-camp")).catch(() => {});
      }
      await espera(120);
    }
    P.emPausa = false;
  })();
  P.para = () => { P.parado = true; return P.promessa; };
  return P;
}
// o calendário (de uma página): id → { a, b, n (a rodada) } e os tipos dos técnicos
const calendario = ap => ap.p.evaluate(() => {
  const C = TM.leilaoSessao.atual().ver().camp, cal = {};
  C.rodadas.forEach(R => R.jogos.forEach(g => { cal[g.id] = { a: g.a, b: g.b, n: R.n }; }));
  return { cal, tipos: C.tipos };
});
// o Ver o jogo de um jogo da rodada à mostra pela tela (o ‹ › até ela) e o 2D
async function verJogoDaLista(ap, cod, id, n, vis) {
  for (let k = 0; k < 16; k++) {
    const vista = await ap.p.evaluate(() => { const x = document.querySelector(".lei-rodada[data-rodada]"); return x ? +x.dataset.rodada : null; });
    if (vista == null || vista === n) break;
    await clicaSel(ap, vista > n ? ".lei-rod-bt[data-foco='rod-ant']" : ".lei-rod-bt[data-foco='rod-prox']");
    await espera(150);
  }
  const ok = await clicaSel(ap, `.lei-rodada .lei-jogo[data-jogo='${id}'] .lei-jg-ver`);
  if (!ok) { vis.ruins.push({ jogo: id, semBotao: true }); return false; }
  await ate(ap.p, () => TM.ui.current() === "leilao-jogo", null, 10000);
  await verNo2D(ap, cod, vis);
  await ate(ap.p, () => TM.ui.current() === "leilao-camp", null, 15000);
  return true;
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
  // o formato Pontos + mata-mata (o campeonato misto com 2: a rodada de pontos e a Final)
  await clicaSel(A, ".lei-fmt[data-fmt='misto']");
  const fmtD = await ate(A.p, () => { const b = document.querySelector(".lei-fmt[data-fmt='misto']"); return !!(b && b.getAttribute("aria-pressed") === "true"); }, null, 5000);
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
  confere(`${ID}1 criar sala pela tela: a sala ${cod} no saguão (dono, regras, edição pública, 2 vagas, sem bots, o formato Pontos + mata-mata), o código ••••• até o olho, o QR só com o código à mostra, Copiar convite e Compartilhar com o link ?leilao=`,
    /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(cod) && s && s.meta.estado === "saguao" && s.meta.dono === "uidAna" && s.meta.regras === Lx.REGRAS && s.meta.edicao === "public" && s.cfg.vagas === 2 && s.cfg.bots === 0 && fmtD && s.cfg.formato === "misto" &&
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

  /* D14 a escalação pela tela (o Pronto nas duas) e o campeonato MISTO com 2: a rodada de pontos e a Final de amigo contra
     amigo simuladas ao abrir a rodada (até o PR 5); as duas páginas vão sozinhas ao Campeonato e veem os mesmos jogos, a
     mesma tabela e o mesmo campeão, com os nós dos jogos iguais aos do servidor; cada jogo reservado e gravado uma vez */
  const naEsc = await ateNode(async () => (await rota(A)) === "leilao-escalacao" && (await rota(B)) === "leilao-escalacao", 20000);
  await ate(A.p, () => [...document.querySelectorAll(".lei-screen button")].some(b => /^Pronto/.test(b.textContent.trim()) && !b.disabled), null, 10000);
  await clica(A, "^Pronto$"); await clica(B, "^Pronto$");
  const camp = await ateNode(() => { const x = sala(cod); return x && (x.meta.estado === "camp" || x.meta.estado === "fim"); }, 30000);
  const naCamp = await ateNode(async () => (await rota(A)) === "leilao-camp" && (await rota(B)) === "leilao-camp", 20000);
  const fimS = await ateNode(() => { const x = sala(cod); return x && x.meta.estado === "fim"; }, 60000);
  for (const ap of [A, B]) await ate(ap.p, () => !!document.querySelector(".lei-campeao") && !!document.querySelector(".lei-rodada .lei-jg-ver"), null, 15000);
  const ciD = await campIgual([A, B], cod), hD = confereHist(cod);
  const vistas = await Promise.all([A, B].map(ap => ap.p.evaluate(() => {
    const V = TM.leilaoSessao.atual().ver(), C = V.camp, li = document.querySelector(".lei-rodada .lei-jogo"), id = li && li.dataset.jogo;
    let g = null; C.rodadas.forEach(R => R.jogos.forEach(x => { if (x.id === id) g = x; }));
    return { estado: V.estado, formato: C.formato, fases: C.rodadas.map(R => R.fase).join(","), tabela: C.tabela ? C.tabela.length : 0, chave: !!document.querySelector(".lei-chave"),
      campeao: C.campeao, nome: C.campeao != null ? V.tecnicos[C.campeao].clube.nome : null, poster: (document.querySelector(".lei-campeao") || {}).innerText || "",
      id, linha: li ? li.querySelector(".lei-jg-pl").textContent : null, placar: g && g.placar ? g.placar.join(" × ") : null };
  })));
  confere(`${ID}14 a escalação pela tela e o campeonato misto com 2: as duas vão sozinhas à Escalação e, com o Pronto, ao Campeonato; a rodada de pontos e a Final de amigo contra amigo simuladas ao abrir a rodada (${JSON.stringify(hD.conta)}); os mesmos jogos, a mesma tabela e o mesmo campeão nas duas e no servidor`,
    naEsc && camp && naCamp && fimS && ciD.ok && ciD.info.n === 2 && hD.n === 2 && !hD.ruins.length && hD.conta.abertura === 2 &&
      vistas.every(v => v.estado === "fim" && v.formato === "misto" && v.fases === "liga,mata" && v.tabela === 2 && v.chave && v.nome && v.poster.indexOf(v.nome) >= 0 && v.linha === v.placar),
    { naEsc, camp, naCamp, fimS, ci: ciD.info, hist: hD, vistas });
  // o Ver o jogo dos dois jogos pela tela (a rodada de pontos pelo ‹): o resultado gravado no servidor no 2D, sem pausa
  await vigiaCamp(A);
  const visD = novoVis(), calD = (await calendario(A)).cal;
  for (const id of Object.keys(calD)) await verJogoDaLista(A, cod, id, calD[id].n, visD);
  const vgD = await juntaVigia(A);
  confere(`${ID}14b o Ver o jogo pela tela (a rodada de pontos e a Final): o resultado gravado no servidor no 2D, sem pausa, com os escudos desenhados e sem sorteio pelo 2D`,
    visD.jogos === 2 && !visD.ruins.length && vgD.sims2d === 0, { vis: visD, sims2d: vgD.sims2d });
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
  const { cod, r } = await salaPelaApi(aps, { liga: "br", vagas: 6, bots: 2, tempo: 10, formato: "pontos" });
  const C = vigia(cod), s = sala(cod);
  confere(`${ID}1 4 páginas + 2 bots na sala (o pedido, o aceite e o Pronto pela API) e o Começar: 6 técnicos, 78 lotes, o mesmo vivo em todas; o campeonato de pontos corridos`,
    r && r.ok && s.ordem.length === 6 && C.ctx && C.ctx.fila.length === 78 && s.ordem.slice(4).every(u => s.tec[u].papel === "bot") && s.cfg.formato === "pontos", { r, ordem: s.ordem, formato: s.cfg.formato });
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
  // a escalação logo no fim do leilão (os 60 s dela são 10 s de verdade): P1 pela tela, P2b e P3 pela API
  for (const ap of vivos) await ap.p.evaluate(() => window.__lt.parar()).catch(() => {});
  const escP1 = await ate(P1.p, () => TM.ui.current() === "leilao-escalacao" && [...document.querySelectorAll(".lei-screen button")].some(b => /^Pronto/.test(b.textContent.trim()) && !b.disabled), null, 15000);
  const prP1 = escP1 && await clica(P1, "^Pronto$");
  for (const ap of [P2b, P3]) await ap.p.evaluate(() => TM.leilaoSessao.atual().prontoEscalacao(true)).catch(() => null);
  const vF = Lx.norm(vivoServ(cod), C.ctx);
  const botsDepois = C.compras.filter(x => x.hora > horaQueda && x.t >= 4).length + Object.keys(C.ultLance).filter(t => +t >= 4 && C.ultLance[t] > horaQueda).length;
  const donoParado = vF.cx[0][0] === cxDono && vF.d.split("").every((x, i) => x !== Lx.letra(0) || dDono.charAt(i) === x);
  confere(`${ID}5 a 1ª página (o dono) cai na metade: as outras levam o leilão até o fim, os bots seguem comprando (${botsDepois} compras e lances depois da queda) e quem caiu não gasta mais`,
    acabou && botsDepois > 0 && donoParado, { acabou, botsDepois, donoParado, seq: vF.seq });
  const fim = await fimIgual(ID, vivos, cod);
  confere(`${ID}6 o mesmo fim nas 3 páginas que ficaram e no servidor (com os relógios +5 s, −5 s e o pulo de +60 s)`, acabou && fim.ok, fim.info);
  confOk(`${ID}6b`, cod);

  /* ---------- o campeonato de PONTOS CORRIDOS (6 técnicos: as 4 pessoas e os 2 bots) pela tela ---------- */
  /* Q7 o dono (a página que caiu no leilão) volta pelo link ?leilao= com o relógio −5 s: é da sala, volta (não pede); quem
     confirmou a escalação vai sozinho ao Campeonato */
  const D0 = await aparelho("Quatro-0b", "uidQ0", { w: 390, h: 844, toque: true, desvio: -5000, lat: 8, busca: "?leilao=" + cod });
  const voltouD = await ate(D0.p, () => { const S = TM.leilaoSessao.atual(); return !!(S && S.eu === 0 && !S.pedido && /^leilao-(escalacao|camp)$/.test(TM.ui.current())); }, null, 40000);
  const rotaD = await rota(D0);
  let prD = null;
  if (rotaD === "leilao-escalacao" && await ate(D0.p, () => [...document.querySelectorAll(".lei-screen button")].some(b => /^Pronto/.test(b.textContent.trim()) && !b.disabled), null, 5000)) prD = await clica(D0, "^Pronto$");
  const aps4 = [D0, P1, P2b, P3];
  const campQ = await ateNode(() => { const x = sala(cod); return !!(x && (x.meta.estado === "camp" || x.meta.estado === "fim")); }, real(80000) + 20000, 200);
  const foiP1 = await ate(P1.p, () => TM.ui.current() === "leilao-camp" && !!document.querySelector(".lei-rodada"), null, 20000);
  for (const ap of aps4) await vigiaCamp(ap);
  const { cal, tipos } = await calendario(P1);
  const s7 = sala(cod);
  confere(`${ID}7 a escalação e a volta do dono: P1 confirma pela tela (P2b e P3 pela API) e vai sozinha ao Campeonato; o dono que caiu no leilão volta pelo link ?leilao= (é da sala: volta, não pede; ${rotaD}${prD ? ", Pronto pela tela" : ""}); 6 técnicos, 10 rodadas, 30 jogos`,
    escP1 && prP1 && voltouD && campQ && foiP1 && s7.cfg.formato === "pontos" && Object.keys(cal).length === 30 && Math.max(...Object.values(cal).map(g => g.n)) === 10 && tipos.filter(x => x === "bot").length === 2,
    { escP1, prP1, voltouD, rotaD, prD, campQ, foiP1, formato: s7.cfg.formato, jogos: Object.keys(cal).length, tipos });

  // os acontecimentos, cada um no seu laço (pelas páginas e pelo servidor), enquanto os pilotos jogam pela tela
  const bot = t => tipos[t] === "bot";
  const jogoDe = id => banco.ler(`leiloes/${cod}/jogos/${id}`);
  const E = { prazo: { id: null, amostras: [] }, queda: { id: null, feito: false }, pend: { id: null, feito: false }, recarga: {} };
  // o jogo de t contra um bot, da rodada n0 em diante, com o prazo correndo no servidor (outro que não `menos`)
  const abertoContraBot = (t, n0, menos) => Object.keys(cal).find(id => {
    const g = cal[id]; if (id === menos || g.n < n0 || (g.a !== t && g.b !== t) || !bot(g.a === t ? g.b : g.a)) return false;
    const j = jogoDe(id); return !!(j && j.e === "aberto" && !j.parado);
  }) || null;
  const outrosFeitos = id => Object.keys(cal).filter(k => k !== id && cal[k].n === cal[id].n).every(k => { const j = jogoDe(k); return !!(j && j.e === "feito"); });
  // os pilotos: P1 deixa o 1º jogo dele contra um bot para o prazo; P3 espera a queda e os pendentes nos jogos contra um bot
  // da 2ª rodada em diante; o resto toca em Simular partida assim que dá
  const pil = {
    D0: pilotoCamp(D0, cod),
    P1: pilotoCamp(P1, cod, { simula: mj => { if (!mj.contraBot) return true; if (E.prazo.id == null) E.prazo.id = mj.id; return mj.id !== E.prazo.id; } }),
    P2b: pilotoCamp(P2b, cod),
    P3: pilotoCamp(P3, cod, { simula: (mj, r) => !mj.contraBot || r.rodada < 2 || (E.queda.feito && (mj.id === E.queda.id || E.pend.feito)) })
  };
  // o prazo da tela de P1 (relógio +5 s) contra o do servidor, até o jogo sair do aberto
  async function roteiroPrazo() {
    if (!(await ateNode(() => E.prazo.id != null, real(1800000), 200))) return;
    const id = E.prazo.id, t0r = Date.now();
    while (Date.now() - t0r < real(400000)) {
      const j = jogoDe(id);
      if (j && j.e !== "aberto") break;
      const t = await P1.p.evaluate(() => TM.leilaoTela.estado().prazo).catch(() => null);
      const j2 = jogoDe(id), agora = rel.agora(), m = t && /Simulado sozinho em (\d+):(\d\d)/.exec(t);
      if (j2 && j2.e === "aberto" && !j2.parado && m) E.prazo.amostras.push({ tela: (+m[1] * 60 + +m[2]) * 1000, serv: Math.round(j2.ini + j2.resta - agora) });
      await espera(300);
    }
  }
  // a página que cai (P3) com o prazo correndo contra um bot, da 2ª rodada em diante; volta depois de as outras seguirem
  async function roteiroQueda() {
    const Q = E.queda;
    if (!(await ateNode(() => { const id = abertoContraBot(3, 2, null); if (id) Q.id = id; return !!id; }, real(1800000), 120))) return;
    const id = Q.id;
    banco.derrubar(P3.p);
    Q.desde = rel.agora();
    Q.parou = await ateNode(() => { const j = jogoDe(id); return !!(j && j.e === "aberto" && j.parado); }, real(60000) + 15000, 150);
    Q.outros = await ateNode(() => outrosFeitos(id), real(200000) + 20000, 200);
    await espera(real(15000));
    Q.jFora = jogoDe(id);
    banco.conectar(P3.p);
    Q.ate = rel.agora();
    Q.voltou = await ateNode(() => { const j = jogoDe(id); return !!(j && (j.e !== "aberto" || !j.parado)); }, real(60000) + 15000, 150);
    Q.redeOk = await ate(P3.p, () => TM.leilaoSessao.atual().ver().rede === "ok", null, 30000);
    Q.feito = true;
    Q.gravado = await ateNode(() => { const j = jogoDe(id); return !!(j && j.e === "feito"); }, real(150000) + 20000, 200);
  }
  // depois da queda: P3 some (a página escondida) com o prazo do próximo jogo dele contra um bot correndo; com os outros
  // jogos da rodada prontos, o dono toca em "Simular os pendentes" (e, antes, nada sobre nada com a caixa dos pendentes)
  async function roteiroPendentes() {
    const P = E.pend;
    if (!(await ateNode(() => E.queda.feito, real(2400000), 300))) return;
    if (!(await ateNode(() => { const id = abertoContraBot(3, 2, E.queda.id); if (id) P.id = id; return !!id; }, real(1800000), 120))) return;
    const id = P.id;
    await P3.p.evaluate(() => window.__esconde(true));
    P.parou = await ateNode(() => { const j = jogoDe(id); return !!(j && j.e === "aberto" && j.parado); }, real(60000) + 15000, 150);
    P.so = await ateNode(() => outrosFeitos(id), real(200000) + 20000, 200);
    pil.D0.pausado = true;
    P.dono = await ateNode(() => pil.D0.emPausa, 30000);
    P.viu = await ate(D0.p, () => { const b = document.querySelector(".lei-pend-bt"); return !!(b && !b.disabled); }, null, 20000);
    P.txt = await D0.p.evaluate(() => (document.querySelector(".lei-pend") || {}).innerText || "").catch(() => "");
    P.ns = await nadaSobreNada(D0, "camp-meio", () => !!document.querySelector(".lei-rodada") && !!document.querySelector(".lei-pend-bt"));
    P.clicou = await clicaSel(D0, ".lei-pend-bt");
    P.gravado = await ateNode(() => { const j = jogoDe(id); return !!(j && j.e === "feito"); }, 30000, 150);
    P.feito = true;
    pil.D0.pausado = false;
    await P3.p.evaluate(() => window.__esconde(false));
    P.voltou = await ate(P3.p, () => TM.leilaoSessao.atual().ver().rede === "ok", null, 30000);
  }
  // recarregar no meio (P2b, da 3ª rodada em diante): volta pelo ?leilao= à aba Campeonato com a mesma vista
  async function roteiroRecarga() {
    const R = E.recarga;
    if (!(await ateNode(async () => { const x = await resumoCamp(P1); return !!(x && x.rodada >= 3); }, real(1800000), 400))) return;
    pil.P2b.pausado = true;
    R.pausou = await ateNode(() => pil.P2b.emPausa, 30000);
    await juntaVigia(P2b);
    R.antes = ((await resumoCamp(P2b)) || {}).rodada;
    await P2b.p.goto(BASE + "/index.html?leilao=" + cod, { waitUntil: "load" });
    await P2b.p.waitForFunction(() => window.TM && TM.ui && TM.leilaoSessao && window.__lt, null, { timeout: 60000 });
    R.voltou = await ate(P2b.p, () => { const S = TM.leilaoSessao.atual(); return TM.ui.current() === "leilao-camp" && !!(S && S.eu === 2 && S.ver().camp); }, null, 40000);
    await vigiaCamp(P2b);
    R.igual = await ateNode(async () => { const [a, b] = await Promise.all([resumoCamp(P1), resumoCamp(P2b)]); return !!(a && b && a.r && a.r === b.r && JSON.stringify(a.jogos) === JSON.stringify(b.jogos)); }, 30000, 200);
    R.depois = ((await resumoCamp(P2b)) || {}).rodada;
    pil.P2b.pausado = false;
  }
  const roteiros = Promise.all([roteiroPrazo(), roteiroQueda(), roteiroPendentes(), roteiroRecarga()]);
  const acabouC = await ateNode(() => { const x = sala(cod); return !!(x && x.meta.estado === "fim"); }, real(2400000), 500);
  await Promise.race([roteiros, espera(30000)]);
  E.queda.feito = true; E.pend.feito = true;
  for (const k of Object.keys(pil)) { pil[k].pausado = false; }
  await Promise.race([Promise.all(Object.values(pil).map(x => x.promessa)), espera(60000)]);
  for (const k of Object.keys(pil)) pil[k].parado = true;
  const ci4 = await campIgual(aps4, cod);
  const h4 = confereHist(cod), motivoDe = id => { const L = HIST[cod].log[id] || [], x = L.find(y => y.j && y.j.e === "reservado"); return x ? x.j.motivo : null; };
  const vg4 = []; for (const ap of aps4) vg4.push(await juntaVigia(ap));
  confere(`${ID}8 o campeonato de pontos corridos até o campeão: os mesmos 30 jogos, a mesma tabela e o mesmo campeão nas 4 páginas, com os nós dos jogos de cada uma iguais aos do servidor; ninguém congelou a sala`,
    acabouC && ci4.ok && ci4.info.n === 30, ci4.info);
  confere(`${ID}9 no servidor, cada jogo reservado e gravado UMA vez, com a mesma trava, os mesmos times e as mesmas escalações; o prazo só vencido pela hora do servidor e com 2 min correndo (${JSON.stringify(h4.conta)})`,
    h4.n === 30 && !h4.ruins.length && (h4.conta.pedido || 0) >= 4 && (h4.conta.abertura || 0) >= 1 && (h4.conta.prazo || 0) >= 1 && (h4.conta.dono || 0) >= 1, { ruins: h4.ruins.slice(0, 4), conta: h4.conta, prazos: h4.prazos });
  const visQ = novoVis(); Object.values(pil).forEach(x => { for (const k of ["jogos", "animados", "placares", "pror", "ouro", "pen"]) visQ[k] += x.vis[k]; visQ.ruins.push(...x.vis.ruins); });
  const cliques = Object.fromEntries(Object.entries(pil).map(([k, x]) => [k, x.cliques.length]));
  const aoAbrir = vg4.flatMap(x => x.aoAbrir), sims2d = vg4.reduce((a, x) => a + x.sims2d, 0), totCliques = Object.values(cliques).reduce((a, n) => a + n, 0);
  confere(`${ID}10 o "Simular partida" pela tela nas 4 páginas (${JSON.stringify(cliques)}): cada toque abre o 2D, só com o jogo já gravado (também na vista da página), e o 2D toca o placar gravado no servidor, sem o botão de pausa, com os escudos desenhados e sem sorteio pelo 2D (${visQ.jogos} jogos no 2D; ${visQ.pror} prorrogações)`,
    Object.values(cliques).every(n => n >= 1) && visQ.jogos === totCliques && !visQ.ruins.length && aoAbrir.length === totCliques && aoAbrir.every(x => x.e === "feito") && sims2d === 0,
    { cliques, vis: visQ, aoAbrir: aoAbrir.filter(x => x.e !== "feito").slice(0, 4), sims2d });
  const am = E.prazo.amostras, difs = am.map(x => x.tela - x.serv), pzP1 = h4.prazos.find(x => x.id === E.prazo.id);
  confere(`${ID}11 o prazo de 2 min com o relógio da página +5 s: a tela mostra o prazo pela hora do servidor (${am.length} amostras; diferença ${difs.length ? Math.min(...difs) : "?"} a ${difs.length ? Math.max(...difs) : "?"} ms) e, vencido, o jogo é simulado pelo prazo (${pzP1 ? pzP1.atraso + " ms depois, " + Math.round(pzP1.corre / 1000) + " s correndo" : "?"})`,
    E.prazo.id != null && am.length >= 8 && difs.every(d => Math.abs(d) <= 2500) && motivoDe(E.prazo.id) === "prazo" && !!pzP1, { id: E.prazo.id, am: am.slice(0, 3).concat(am.slice(-3)), motivo: motivoDe(E.prazo.id) });
  const Q = E.queda, LQ = Q.id ? HIST[cod].log[Q.id] || [] : [];
  const reservouFora = LQ.some(x => x.j && x.j.e !== "aberto" && x.hora >= (Q.desde || 0) && x.hora <= (Q.ate || 0));
  confere(`${ID}12 a página que cai no meio do campeonato (P3, com o prazo correndo contra um bot): as outras seguem (os outros jogos da rodada saem), o prazo dela para no servidor e ninguém reserva o jogo enquanto ela está fora; de volta, o prazo volta a correr e ela simula pela tela`,
    !!Q.id && Q.parou && Q.outros && Q.jFora && Q.jFora.e === "aberto" && Q.jFora.parado && !reservouFora && Q.voltou && Q.redeOk && Q.gravado && motivoDe(Q.id) === "pedido",
    { id: Q.id, parou: Q.parou, outros: Q.outros, jFora: Q.jFora, reservouFora, voltou: Q.voltou, redeOk: Q.redeOk, gravado: Q.gravado, motivo: Q.id && motivoDe(Q.id) });
  const R = E.recarga;
  confere(`${ID}13 recarregar no meio do campeonato (P2b, na rodada ${R.antes}): volta pelo ?leilao= à aba Campeonato com a mesma vista e os mesmos jogos das outras`, R.pausou && R.voltou && R.igual, R);
  const P = E.pend;
  confere(`${ID}14 o dono toca em "Simular os pendentes" pela tela: com quem sumiu (P3, a página escondida) parado no prazo e os outros jogos da rodada prontos, o jogo dele é simulado pelo dono e a rodada anda`,
    !!P.id && P.parou && P.so && P.dono && P.viu && /1 jogo esperando quem não está aqui/.test(P.txt || "") && ((P.txt || "").match(/não está aqui/g) || []).length === 2 && P.clicou && P.gravado && motivoDe(P.id) === "dono" && P.voltou,
    { id: P.id, parou: P.parou, so: P.so, dono: P.dono, viu: P.viu, txt: P.txt, clicou: P.clicou, gravado: P.gravado, motivo: P.id && motivoDe(P.id), voltou: P.voltou });
  const nsFim4 = await nadaSobreNada(P1, "camp-fim-pontos", () => !!document.querySelector(".lei-campeao") && !!document.querySelector(".lei-tabela"));
  const nsMeio = P.ns || { ruins: [{ tela: "camp-meio", semMedida: true }], medidas: [] };
  // os clubes com o mesmo nome (o "Meu Clube" de quem não tem o Ultimate) se distinguem pelo técnico na tabela e no 2D
  const rep4 = await P1.p.evaluate(() => {
    const S = TM.leilaoSessao.atual(), V = S.ver(), C = V.camp, nome = t => V.tecnicos[t].clube.nome.toLowerCase();
    const linhas = [...document.querySelectorAll(".lei-tabela tbody .lei-tab-clube")].map(e => e.innerText.replace(/\s+/g, " ").trim());
    const g = C.rodadas.flatMap(R => R.jogos).find(x => x.e === "feito" && nome(x.a) === nome(x.b)), pt = g ? S.partida(g.id) : null;
    return { linhas, tags: document.querySelectorAll(".lei-tabela .lei-tec-tag").length, iguais: V.tecnicos.filter(x => x.clube.nome === "Meu Clube").length, d2: pt ? pt.times.map(x => x.name) : null };
  }).catch(e => ({ erro: String(e) }));
  confere(`${ID}16 os clubes com o mesmo nome (${rep4.iguais} "Meu Clube") se distinguem pelo técnico na tabela (${(rep4.linhas || []).join(" | ")}) e no placar do 2D (${(rep4.d2 || []).join(" × ")})`,
    rep4.iguais >= 2 && rep4.linhas && new Set(rep4.linhas).size === rep4.linhas.length && rep4.tags === rep4.iguais && rep4.d2 && rep4.d2[0] !== rep4.d2[1], rep4);
  confere(`${ID}15 nada sobre nada na aba Campeonato no meio (o dono, com a caixa dos pendentes) e no fim (a tabela e o pôster) em 360×740, 844×390 e 1280×800, no escuro e no claro (${nsMeio.medidas.length + nsFim4.medidas.length} medidas; a tabela sem rolar de lado; só escudos desenhados)`,
    !nsMeio.ruins.length && !nsFim4.ruins.length && nsMeio.medidas.length === 6 && nsFim4.medidas.length === 6, nsMeio.ruins.concat(nsFim4.ruins).slice(0, 4));
  for (const ap of [D0, ...vivos]) await ap.cx.close().catch(() => {});
}

/* ====================================================================================================== */
async function casoOito() {
  const ID = "O";
  const TAM = [[390, 844, true], [1280, 800, false], [844, 390, true], [360, 740, true], [430, 932, true], [820, 1180, true], [1440, 900, false], [1920, 1080, false]];
  const aps = [];
  for (let k = 0; k < 8; k++) aps.push(await aparelho("Oito-" + k, "uidO" + k, { w: TAM[k][0], h: TAM[k][1], toque: TAM[k][2], lat: [4, 6, 8, 10, 12, 14, 16, 20][k], desvio: (k % 3 - 1) * 5000 }));
  const b0 = aps.map(ap => banco.bytes(ap.p).desce);
  const { cod, r } = await salaPelaApi(aps, { liga: "de", vagas: 8, bots: 0, tempo: 10, formato: "mata" });
  const C = vigia(cod);
  confere(`${ID}1 8 páginas na sala e o Começar: 104 lotes, o mesmo vivo em todas; o campeonato mata-mata`, r && r.ok && C.ctx && C.ctx.fila.length === 104 && sala(cod).cfg.formato === "mata", { r, formato: sala(cod).cfg.formato });
  // as duas primeiras pela tela (na aba Leilão); as outras pela API, fora das telas da sala (o online não para)
  for (let k = 0; k < 8; k++) await aps[k].p.evaluate(k => TM.ui.go(k < 2 ? "leilao-lote" : "modes"), k);
  for (let k = 0; k < 8; k++) await pilotar(aps[k], k < 2 ? "tela" : "api");
  const acabou = await ateOFim(cod, aps, real(104 * 40000) + 120000);
  const b1 = aps.map(ap => banco.bytes(ap.p).desce);
  // a escalação logo no fim do leilão (os 60 s dela são 10 s de verdade): as duas primeiras pela tela, as outras pela API
  for (const ap of aps) await ap.p.evaluate(() => window.__lt.parar()).catch(() => {});
  const escTela = [];
  for (const ap of aps.slice(0, 2)) {
    const pode = await ate(ap.p, () => TM.ui.current() === "leilao-escalacao" && [...document.querySelectorAll(".lei-screen button")].some(b => /^Pronto/.test(b.textContent.trim()) && !b.disabled), null, 15000);
    escTela.push(pode && await clica(ap, "^Pronto$"));
  }
  for (const ap of aps.slice(2)) await ap.p.evaluate(() => TM.leilaoSessao.atual().prontoEscalacao(true)).catch(() => null);
  const fim = await fimIgual(ID, aps, cod);
  confere(`${ID}2 o leilão de 8 até o fim: o mesmo vivo, as mesmas compras e caixas nas 8 páginas e no servidor`, acabou && fim.ok, fim.info);
  confOk(`${ID}2b`, cod);
  const kb = aps.map((ap, k) => (b1[k] - b0[k]) / 1024);
  const max = Math.max(...kb), tot = kb.reduce((a, b) => a + b, 0);
  confere(`${ID}3 os bytes baixados do banco por página no leilão de 8 com 104 lotes: ${kb.map(x => x.toFixed(0)).join(" · ")} KB (o maior ${(max / 1024).toFixed(2)} MB; ${(tot / 1024).toFixed(1)} MB no total; teto 3 MB por página)`,
    acabou && max > 50 && max < 3 * 1024, { kb });

  /* ---------- o campeonato MATA-MATA com 8 (todos pessoas: os jogos de amigo contra amigo simulados ao abrir a rodada) ---------- */
  /* O4 todos prontos: o campeonato começa e as duas da tela vão sozinhas ao Campeonato */
  const campO = await ateNode(() => { const x = sala(cod); return !!(x && (x.meta.estado === "camp" || x.meta.estado === "fim")); }, real(70000) + 20000, 200);
  const foramO = await ateNode(async () => (await rota(aps[0])) === "leilao-camp" && (await rota(aps[1])) === "leilao-camp", 20000);
  confere(`${ID}4 a escalação: as duas primeiras confirmam pela tela (as outras 6 pela API) e o campeonato começa com todos prontos; as duas vão sozinhas ao Campeonato`,
    escTela.length === 2 && escTela.every(Boolean) && campO && foramO, { escTela, campO, foramO });
  /* O5 até o campeão: a mesma chave e o mesmo campeão nas 8 e no servidor; cada jogo uma vez, ao abrir a rodada */
  const fimO = await ateNode(() => { const x = sala(cod); return !!(x && x.meta.estado === "fim"); }, real(600000), 300);
  const b2 = aps.map(ap => banco.bytes(ap.p).desce);
  const ciO = await campIgual(aps, cod), hO = confereHist(cod);
  const nomes = await aps[0].p.evaluate(() => TM.leilaoSessao.atual().ver().camp.rodadas.map(R => R.nome + ":" + R.jogos.length).join(", "));
  confere(`${ID}5 o mata-mata com 8 até o campeão (${nomes}): todos os jogos de amigo contra amigo simulados ao abrir a rodada, cada um reservado e gravado uma vez no servidor; a mesma chave e o mesmo campeão nas 8 páginas, com os nós dos jogos iguais aos do servidor`,
    fimO && ciO.ok && ciO.info.n === 7 && hO.n === 7 && !hO.ruins.length && hO.conta.abertura === 7 && nomes === "Quartas de final:4, Semifinal:2, Final:1", { ci: ciO.info, hist: hO, nomes });
  /* O6 o Ver o jogo pela tela: a Final nas duas e as semifinais na 1ª */
  for (const ap of aps.slice(0, 2)) await vigiaCamp(ap);
  const visO = novoVis(), calO = (await calendario(aps[0])).cal;
  const fin = Object.keys(calO).filter(id => calO[id].n === 3), semi = Object.keys(calO).filter(id => calO[id].n === 2);
  for (const id of fin) { await verJogoDaLista(aps[0], cod, id, 3, visO); await verJogoDaLista(aps[1], cod, id, 3, visO); }
  for (const id of semi) await verJogoDaLista(aps[0], cod, id, 2, visO);
  const vgO = [await juntaVigia(aps[0]), await juntaVigia(aps[1])];
  confere(`${ID}6 o Ver o jogo pela tela (a Final nas duas, as semifinais na 1ª): o resultado gravado no servidor no 2D, sem pausa, com os escudos desenhados e sem sorteio pelo 2D (${visO.pror} prorrogações, ${visO.pen} pênaltis)`,
    visO.jogos === 4 && !visO.ruins.length && vgO.every(x => x.sims2d === 0), { vis: visO, sims2d: vgO.map(x => x.sims2d) });
  /* O7 nada sobre nada no fim do mata-mata (a chave e o pôster) */
  const nsO = await nadaSobreNada(aps[1], "camp-fim-mata", () => !!document.querySelector(".lei-campeao") && !!document.querySelector(".lei-chave"));
  confere(`${ID}7 nada sobre nada no fim do mata-mata (a chave e o pôster) em 360×740, 844×390 e 1280×800, no escuro e no claro (${nsO.medidas.length} medidas; só escudos desenhados)`,
    !nsO.ruins.length && nsO.medidas.length === 6, nsO.ruins.slice(0, 4));
  /* O8 os bytes do campeonato (com a escalação), somados aos do leilão */
  const kbC = aps.map((ap, k) => (b2[k] - b1[k]) / 1024), kbT = kb.map((x, k) => x + kbC[k]);
  const maxC = Math.max(...kbC), maxT = Math.max(...kbT), totT = kbT.reduce((a, b) => a + b, 0);
  confere(`${ID}8 os bytes baixados do banco por página na escalação e no mata-mata de 8: ${kbC.map(x => x.toFixed(0)).join(" · ")} KB (o maior ${maxC.toFixed(0)} KB); com o leilão, o maior ${(maxT / 1024).toFixed(2)} MB por página e ${(totT / 1024).toFixed(1)} MB no total (teto 3 MB por página)`,
    fimO && maxC > 1 && maxC < 1024 && maxT < 3 * 1024, { kbC, kbT });
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
  const vv = vivoServ(cod); vv.cx[0][0] += 50; REGRAS.adulteradas.add(cod); banco.gravar("leiloes/" + cod + "/vivo", vv);
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
confere(`G3 as regras opcionais (o .validate do LEIA-ME) não recusariam nenhuma gravação honesta das páginas (${REGRAS.gravacoes} gravações conferidas; fora as salas que o teste adultera: ${[...REGRAS.adulteradas].join(", ") || "nenhuma"}; recusadas de propósito: ${REGRAS.esperadas.length}, o batimento a caminho de quem perdeu o clube)`,
  REGRAS.gravacoes > 0 && !REGRAS.recusas.length, { n: REGRAS.recusas.length, recusas: REGRAS.recusas.slice(0, 5), esperadas: REGRAS.esperadas.slice(0, 2) });
await nav.close().catch(() => {});
if (srv) await srv.fechar();
console.log(`${falhas.length ? "REPROVOU" : "PASSOU"}: ${oks.length} de ${oks.length + falhas.length} itens em ${((performance.now() - t0) / 1000).toFixed(1)} s (fator ${FATOR}; prints em ${PASTA})`);
process.exit(falhas.length ? 1 : 0);
